"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const Q = require("q");
const semver = require("semver");
const generalMobilePlatform_1 = require("../generalMobilePlatform");
const adb_1 = require("./adb");
const package_1 = require("../../common/node/package");
const promise_1 = require("../../common/node/promise");
const packageNameResolver_1 = require("./packageNameResolver");
const outputVerifier_1 = require("../../common/outputVerifier");
const telemetryHelper_1 = require("../../common/telemetryHelper");
const commandExecutor_1 = require("../../common/commandExecutor");
const logCatMonitor_1 = require("./logCatMonitor");
const reactNativeProjectHelper_1 = require("../../common/reactNativeProjectHelper");
/**
 * Android specific platform implementation for debugging RN applications.
 */
class AndroidPlatform extends generalMobilePlatform_1.GeneralMobilePlatform {
    // We set remoteExtension = null so that if there is an instance of androidPlatform that wants to have it's custom remoteExtension it can. This is specifically useful for tests.
    constructor(runOptions, platformDeps = {}) {
        super(runOptions, platformDeps);
        this.runOptions = runOptions;
        this.logCatMonitor = null;
        this.needsToLaunchApps = false;
        if (this.runOptions.target === AndroidPlatform.simulatorString ||
            this.runOptions.target === AndroidPlatform.deviceString) {
            const message = `Target ${this.runOptions.target} is not supported for Android ` +
                "platform. If you want to use particular device or simulator for launching " +
                "Android app, please specify  device id (as in 'adb devices' output) instead.";
            this.logger.warning(message);
            delete this.runOptions.target;
        }
    }
    static showDevMenu(deviceId) {
        return adb_1.AdbHelper.showDevMenu(deviceId);
    }
    static reloadApp(deviceId) {
        return adb_1.AdbHelper.reloadApp(deviceId);
    }
    runApp(shouldLaunchInAllDevices = false) {
        return telemetryHelper_1.TelemetryHelper.generate("AndroidPlatform.runApp", () => {
            const runArguments = this.getRunArgument();
            const env = this.getEnvArgument();
            return reactNativeProjectHelper_1.ReactNativeProjectHelper.getReactNativeVersion(this.runOptions.projectRoot)
                .then(version => {
                if (semver.gte(version, AndroidPlatform.NO_PACKAGER_VERSION)) {
                    runArguments.push("--no-packager");
                }
                const runAndroidSpawn = new commandExecutor_1.CommandExecutor(this.projectPath, this.logger).spawnReactCommand("run-android", runArguments, { env });
                const output = new outputVerifier_1.OutputVerifier(() => Q(AndroidPlatform.RUN_ANDROID_SUCCESS_PATTERNS), () => Q(AndroidPlatform.RUN_ANDROID_FAILURE_PATTERNS)).process(runAndroidSpawn);
                return output
                    .finally(() => {
                    return this.initializeTargetDevicesAndPackageName();
                }).then(() => [this.debugTarget], reason => {
                    if (reason.message === AndroidPlatform.MULTIPLE_DEVICES_ERROR && this.devices.length > 1 && this.debugTarget) {
                        /* If it failed due to multiple devices, we'll apply this workaround to make it work anyways */
                        this.needsToLaunchApps = true;
                        return shouldLaunchInAllDevices
                            ? adb_1.AdbHelper.getOnlineDevices()
                            : Q([this.debugTarget]);
                    }
                    else {
                        return Q.reject(reason);
                    }
                }).then(devices => {
                    return new promise_1.PromiseUtil().forEach(devices, device => {
                        return this.launchAppWithADBReverseAndLogCat(device);
                    });
                });
            });
        });
    }
    enableJSDebuggingMode() {
        return adb_1.AdbHelper.switchDebugMode(this.runOptions.projectRoot, this.packageName, true, this.debugTarget.id);
    }
    disableJSDebuggingMode() {
        return adb_1.AdbHelper.switchDebugMode(this.runOptions.projectRoot, this.packageName, false, this.debugTarget.id);
    }
    prewarmBundleCache() {
        return this.packager.prewarmBundleCache("android");
    }
    getRunArgument() {
        let runArguments = [];
        if (this.runOptions.runArguments && this.runOptions.runArguments.length > 0) {
            runArguments = this.runOptions.runArguments;
        }
        else {
            if (this.runOptions.variant) {
                runArguments.push("--variant", this.runOptions.variant);
            }
            if (this.runOptions.target) {
                runArguments.push("--deviceId", this.runOptions.target);
            }
        }
        return runArguments;
    }
    initializeTargetDevicesAndPackageName() {
        return adb_1.AdbHelper.getConnectedDevices().then(devices => {
            this.devices = devices;
            this.debugTarget = this.getTargetEmulator(devices);
            return this.getPackageName().then(packageName => {
                this.packageName = packageName;
            });
        });
    }
    launchAppWithADBReverseAndLogCat(device) {
        return Q({})
            .then(() => {
            return this.configureADBReverseWhenApplicable(device);
        }).then(() => {
            return this.needsToLaunchApps
                ? adb_1.AdbHelper.launchApp(this.runOptions.projectRoot, this.packageName, device.id)
                : Q(void 0);
        }).then(() => {
            return this.startMonitoringLogCat(device, this.runOptions.logCatArguments);
        });
    }
    configureADBReverseWhenApplicable(device) {
        return Q({}) // For other emulators and devices we try to enable adb reverse
            .then(() => adb_1.AdbHelper.apiVersion(device.id))
            .then(apiVersion => {
            if (apiVersion >= adb_1.AndroidAPILevel.LOLLIPOP) {
                return adb_1.AdbHelper.reverseAdb(device.id, Number(this.runOptions.packagerPort));
            }
            else {
                this.logger.warning(`Device ${device.id} supports only API Level ${apiVersion}. `
                    + `Level ${adb_1.AndroidAPILevel.LOLLIPOP} is needed to support port forwarding via adb reverse. `
                    + "For debugging to work you'll need <Shake or press menu button> for the dev menu, "
                    + "go into <Dev Settings> and configure <Debug Server host & port for Device> to be "
                    + "an IP address of your computer that the Device can reach. More info at: "
                    + "https://facebook.github.io/react-native/docs/debugging.html#debugging-react-native-apps");
                return void 0;
            }
        });
    }
    getPackageName() {
        return new package_1.Package(this.runOptions.projectRoot).name().then(appName => new packageNameResolver_1.PackageNameResolver(appName).resolvePackageName(this.runOptions.projectRoot));
    }
    /**
     * Returns the target emulator, using the following logic:
     * *  If an emulator is specified and it is connected, use that one.
     * *  Otherwise, use the first one in the list.
     */
    getTargetEmulator(devices) {
        let activeFilterFunction = (device) => {
            return device.isOnline;
        };
        let targetFilterFunction = (device) => {
            return device.id === this.runOptions.target && activeFilterFunction(device);
        };
        if (this.runOptions && this.runOptions.target && devices) {
            /* check if the specified target is active */
            const targetDevice = devices.find(targetFilterFunction);
            if (targetDevice) {
                return targetDevice;
            }
        }
        /* return the first active device in the list */
        let activeDevices = devices && devices.filter(activeFilterFunction);
        return activeDevices && activeDevices[0];
    }
    startMonitoringLogCat(device, logCatArguments) {
        this.stopMonitoringLogCat(); // Stop previous logcat monitor if it's running
        // this.logCatMonitor can be mutated, so we store it locally too
        this.logCatMonitor = new logCatMonitor_1.LogCatMonitor(device.id, logCatArguments);
        this.logCatMonitor.start() // The LogCat will continue running forever, so we don't wait for it
            .catch(error => this.logger.warning("Error while monitoring LogCat", error)) // The LogCatMonitor failing won't stop the debugging experience
            .done();
    }
    stopMonitoringLogCat() {
        if (this.logCatMonitor) {
            this.logCatMonitor.dispose();
            this.logCatMonitor = null;
        }
    }
}
AndroidPlatform.MULTIPLE_DEVICES_ERROR = "error: more than one device/emulator";
// We should add the common Android build/run errors we find to this list
AndroidPlatform.RUN_ANDROID_FAILURE_PATTERNS = [{
        pattern: "Failed to install on any devices",
        message: "Could not install the app on any available device. Make sure you have a correctly"
            + " configured device or emulator running. See https://facebook.github.io/react-native/docs/android-setup.html",
    }, {
        pattern: "com.android.ddmlib.ShellCommandUnresponsiveException",
        message: "An Android shell command timed-out. Please retry the operation.",
    }, {
        pattern: "Android project not found",
        message: "Android project not found.",
    }, {
        pattern: "error: more than one device/emulator",
        message: AndroidPlatform.MULTIPLE_DEVICES_ERROR,
    }, {
        pattern: /^Error: Activity class \{.*\} does not exist\.$/m,
        message: "Failed to launch the specified activity. Try running application manually and "
            + "start debugging using 'Attach to packager' launch configuration.",
    }];
AndroidPlatform.RUN_ANDROID_SUCCESS_PATTERNS = ["BUILD SUCCESSFUL", "Starting the app", "Starting: Intent"];
exports.AndroidPlatform = AndroidPlatform;

//# sourceMappingURL=androidPlatform.js.map
