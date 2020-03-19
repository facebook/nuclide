"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const Q = require("q");
const childProcess_1 = require("../../common/node/childProcess");
const commandExecutor_1 = require("../../common/commandExecutor");
// See android versions usage at: http://developer.android.com/about/dashboards/index.html
var AndroidAPILevel;
(function (AndroidAPILevel) {
    AndroidAPILevel[AndroidAPILevel["Marshmallow"] = 23] = "Marshmallow";
    AndroidAPILevel[AndroidAPILevel["LOLLIPOP_MR1"] = 22] = "LOLLIPOP_MR1";
    AndroidAPILevel[AndroidAPILevel["LOLLIPOP"] = 21] = "LOLLIPOP";
    AndroidAPILevel[AndroidAPILevel["KITKAT"] = 19] = "KITKAT";
    AndroidAPILevel[AndroidAPILevel["JELLY_BEAN_MR2"] = 18] = "JELLY_BEAN_MR2";
    AndroidAPILevel[AndroidAPILevel["JELLY_BEAN_MR1"] = 17] = "JELLY_BEAN_MR1";
    AndroidAPILevel[AndroidAPILevel["JELLY_BEAN"] = 16] = "JELLY_BEAN";
    AndroidAPILevel[AndroidAPILevel["ICE_CREAM_SANDWICH_MR1"] = 15] = "ICE_CREAM_SANDWICH_MR1";
    AndroidAPILevel[AndroidAPILevel["GINGERBREAD_MR1"] = 10] = "GINGERBREAD_MR1";
})(AndroidAPILevel = exports.AndroidAPILevel || (exports.AndroidAPILevel = {}));
var KeyEvents;
(function (KeyEvents) {
    KeyEvents[KeyEvents["KEYCODE_BACK"] = 4] = "KEYCODE_BACK";
    KeyEvents[KeyEvents["KEYCODE_DPAD_UP"] = 19] = "KEYCODE_DPAD_UP";
    KeyEvents[KeyEvents["KEYCODE_DPAD_DOWN"] = 20] = "KEYCODE_DPAD_DOWN";
    KeyEvents[KeyEvents["KEYCODE_DPAD_CENTER"] = 23] = "KEYCODE_DPAD_CENTER";
    KeyEvents[KeyEvents["KEYCODE_MENU"] = 82] = "KEYCODE_MENU";
})(KeyEvents || (KeyEvents = {}));
var DeviceType;
(function (DeviceType) {
    DeviceType[DeviceType["AndroidSdkEmulator"] = 0] = "AndroidSdkEmulator";
    DeviceType[DeviceType["Other"] = 1] = "Other";
})(DeviceType = exports.DeviceType || (exports.DeviceType = {}));
const AndroidSDKEmulatorPattern = /^emulator-\d{1,5}$/;
class AdbHelper {
    /**
     * Gets the list of Android connected devices and emulators.
     */
    static getConnectedDevices() {
        return this.childProcess.execToString("adb devices")
            .then(output => {
            return this.parseConnectedDevices(output);
        });
    }
    /**
     * Broadcasts an intent to reload the application in debug mode.
     */
    static switchDebugMode(projectRoot, packageName, enable, debugTarget) {
        let enableDebugCommand = `adb ${debugTarget ? "-s " + debugTarget : ""} shell am broadcast -a "${packageName}.RELOAD_APP_ACTION" --ez jsproxy ${enable}`;
        return new commandExecutor_1.CommandExecutor(projectRoot).execute(enableDebugCommand)
            .then(() => {
            let deferred = Q.defer();
            setTimeout(() => {
                this.stopApp(projectRoot, packageName, debugTarget)
                    .then(() => {
                    return deferred.resolve({});
                });
            }, 200); // We need a little delay after broadcast command
            return deferred.promise;
        })
            .then(() => {
            return this.launchApp(projectRoot, packageName, debugTarget);
        });
    }
    /**
     * Sends an intent which launches the main activity of the application.
     */
    static launchApp(projectRoot, packageName, debugTarget) {
        let launchAppCommand = `adb ${debugTarget ? "-s " + debugTarget : ""} shell am start -n ${packageName}/.MainActivity`;
        return new commandExecutor_1.CommandExecutor(projectRoot).execute(launchAppCommand);
    }
    static stopApp(projectRoot, packageName, debugTarget) {
        let stopAppCommand = `adb ${debugTarget ? "-s " + debugTarget : ""} shell am force-stop ${packageName}`;
        return new commandExecutor_1.CommandExecutor(projectRoot).execute(stopAppCommand);
    }
    static apiVersion(deviceId) {
        return this.executeQuery(deviceId, "shell getprop ro.build.version.sdk").then(output => parseInt(output, 10));
    }
    static reverseAdb(deviceId, packagerPort) {
        return this.execute(deviceId, `reverse tcp:${packagerPort} tcp:${packagerPort}`);
    }
    static showDevMenu(deviceId) {
        let command = `adb ${deviceId ? "-s " + deviceId : ""} shell input keyevent ${KeyEvents.KEYCODE_MENU}`;
        return this.commandExecutor.execute(command);
    }
    static reloadApp(deviceId) {
        let commands = [
            `adb ${deviceId ? "-s " + deviceId : ""} shell input keyevent ${KeyEvents.KEYCODE_MENU}`,
            `adb ${deviceId ? "-s " + deviceId : ""} shell input keyevent ${KeyEvents.KEYCODE_DPAD_UP}`,
            `adb ${deviceId ? "-s " + deviceId : ""} shell input keyevent ${KeyEvents.KEYCODE_DPAD_CENTER}`,
        ];
        return this.executeChain(commands);
    }
    static getOnlineDevices() {
        return this.getConnectedDevices().then(devices => {
            return devices.filter(device => device.isOnline);
        });
    }
    static parseConnectedDevices(input) {
        let result = [];
        let regex = new RegExp("^(\\S+)\\t(\\S+)$", "mg");
        let match = regex.exec(input);
        while (match != null) {
            result.push({ id: match[1], isOnline: match[2] === "device", type: this.extractDeviceType(match[1]) });
            match = regex.exec(input);
        }
        return result;
    }
    static extractDeviceType(id) {
        return id.match(AndroidSDKEmulatorPattern)
            ? DeviceType.AndroidSdkEmulator
            : DeviceType.Other;
    }
    static executeQuery(deviceId, command) {
        return this.childProcess.execToString(this.generateCommandForDevice(deviceId, command));
    }
    static execute(deviceId, command) {
        return this.commandExecutor.execute(this.generateCommandForDevice(deviceId, command));
    }
    static executeChain(commands) {
        return commands.reduce((promise, command) => {
            return promise.then(() => this.commandExecutor.execute(command));
        }, Q(void 0));
    }
    static generateCommandForDevice(deviceId, adbCommand) {
        return `adb -s "${deviceId}" ${adbCommand}`;
    }
}
AdbHelper.childProcess = new childProcess_1.ChildProcess();
AdbHelper.commandExecutor = new commandExecutor_1.CommandExecutor();
exports.AdbHelper = AdbHelper;

//# sourceMappingURL=adb.js.map
