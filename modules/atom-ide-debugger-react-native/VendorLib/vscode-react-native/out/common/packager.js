"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const commandExecutor_1 = require("./commandExecutor");
const exponentHelper_1 = require("../extension/exponent/exponentHelper");
const errorHelper_1 = require("./error/errorHelper");
const internalErrorCode_1 = require("./error/internalErrorCode");
const OutputChannelLogger_1 = require("../extension/log/OutputChannelLogger");
const node_1 = require("./node/node");
const package_1 = require("./node/package");
const promise_1 = require("./node/promise");
const request_1 = require("./node/request");
const reactNativeProjectHelper_1 = require("./reactNativeProjectHelper");
const packagerStatusIndicator_1 = require("../extension/packagerStatusIndicator");
const settingsHelper_1 = require("../extension/settingsHelper");
const Q = require("q");
const path = require("path");
const XDL = require("../extension/exponent/xdlInterface");
const url = require("url");
var PackagerRunAs;
(function (PackagerRunAs) {
    PackagerRunAs[PackagerRunAs["REACT_NATIVE"] = 0] = "REACT_NATIVE";
    PackagerRunAs[PackagerRunAs["EXPONENT"] = 1] = "EXPONENT";
    PackagerRunAs[PackagerRunAs["NOT_RUNNING"] = 2] = "NOT_RUNNING";
})(PackagerRunAs = exports.PackagerRunAs || (exports.PackagerRunAs = {}));
class Packager {
    // BEGIN MODFIFIED BY PELMERS
    constructor(workspacePath, projectPath, packagerPort, packagerStatusIndicator) {
        this.workspacePath = workspacePath;
        this.projectPath = projectPath;
        this.packagerPort = packagerPort;
        this.logger = OutputChannelLogger_1.OutputChannelLogger.getChannel(OutputChannelLogger_1.OutputChannelLogger.MAIN_CHANNEL_NAME, true);
        // END MODIFIED BY PELMERS
        this.packagerRunningAs = PackagerRunAs.NOT_RUNNING;
        this.packagerStatusIndicator = packagerStatusIndicator || new packagerStatusIndicator_1.PackagerStatusIndicator();
    }
    get port() {
        return this.packagerPort || settingsHelper_1.SettingsHelper.getPackagerPort(this.workspacePath);
    }
    static getHostForPort(port) {
        return `localhost:${port}`;
    }
    get statusIndicator() {
        return this.packagerStatusIndicator;
    }
    getHost() {
        return Packager.getHostForPort(this.port);
    }
    getRunningAs() {
        return this.packagerRunningAs;
    }
    startAsReactNative() {
        return this.start(PackagerRunAs.REACT_NATIVE);
    }
    startAsExponent() {
        return this.isRunning()
            .then(running => {
            if (running && this.packagerRunningAs === PackagerRunAs.REACT_NATIVE) {
                return this.killPackagerProcess()
                    .then(() => this.start(PackagerRunAs.EXPONENT));
            }
            else if (running && this.packagerRunningAs === PackagerRunAs.NOT_RUNNING) {
                this.logger.warning(errorHelper_1.ErrorHelper.getWarning("Packager running outside of VS Code. To avoid issues with exponent make sure it is running with .vscode/ as a root."));
                return Q.resolve(void 0);
            }
            else if (this.packagerRunningAs !== PackagerRunAs.EXPONENT) {
                return this.start(PackagerRunAs.EXPONENT);
            }
            else {
                return Q.resolve(void 0);
            }
        })
            .then(() => XDL.setOptions(this.projectPath, { packagerPort: this.port }))
            .then(() => XDL.startExponentServer(this.projectPath))
            .then(() => XDL.startTunnels(this.projectPath))
            .then(() => XDL.getUrl(this.projectPath, { dev: true, minify: false })).then(exponentUrl => {
            return "exp://" + url.parse(exponentUrl).host;
        })
            .catch(reason => {
            return Q.reject(reason);
        });
    }
    stop(silent = false) {
        return this.isRunning()
            .then(running => {
            if (running) {
                if (!this.packagerProcess) {
                    if (!silent) {
                        this.logger.warning(errorHelper_1.ErrorHelper.getWarning("Packager is still running. If the packager was started outside VS Code, please quit the packager process using the task manager."));
                    }
                    return Q.resolve(void 0);
                }
                return this.killPackagerProcess();
            }
            else {
                if (!silent) {
                    this.logger.warning(errorHelper_1.ErrorHelper.getWarning("Packager is not running"));
                }
                return Q.resolve(void 0);
            }
        }).then(() => {
            this.packagerRunningAs = PackagerRunAs.NOT_RUNNING;
        });
    }
    restart(port) {
        if (this.port && this.port !== port) {
            return Q.reject(errorHelper_1.ErrorHelper.getInternalError(internalErrorCode_1.InternalErrorCode.PackagerRunningInDifferentPort, port, this.port));
        }
        const currentRunningState = this.packagerRunningAs;
        return this.isRunning()
            .then(running => {
            if (running) {
                if (!this.packagerProcess) {
                    this.logger.warning(errorHelper_1.ErrorHelper.getWarning("Packager is still running. If the packager was started outside VS Code, please quit the packager process using the task manager. Then try the restart packager again."));
                    return Q.resolve(false);
                }
                return this.killPackagerProcess().then(() => Q.resolve(true));
            }
            else {
                this.logger.warning(errorHelper_1.ErrorHelper.getWarning("Packager is not running"));
                return Q.resolve(true);
            }
        })
            .then(stoppedOK => {
            if (stoppedOK) {
                return this.start(currentRunningState, true);
            }
            else {
                return Q.resolve(void 0);
            }
        });
    }
    prewarmBundleCache(platform) {
        if (platform === "exponent") {
            return Q.resolve(void 0);
        }
        return this.isRunning()
            .then(running => {
            return running ? this.prewarmBundleCacheWithBundleFilename(`index.${platform}`, platform) : void 0;
        });
    }
    isRunning() {
        let statusURL = `http://${this.getHost()}/status`;
        return request_1.Request.request(statusURL)
            .then((body) => {
            return body === "packager-status:running";
        }, (error) => {
            return false;
        });
    }
    prewarmBundleCacheWithBundleFilename(bundleFilename, platform) {
        const indexFileName = path.resolve(this.projectPath, bundleFilename + ".js");
        const bundleURL = `http://${this.getHost()}/${bundleFilename}.bundle?platform=${platform}`;
        return new node_1.Node.FileSystem().exists(indexFileName)
            .then(exists => {
            // If guessed entry point doesn't exist - skip prewarming, since it's not possible
            // at this moment to determine _real_ bundle/ entry point name anyway
            if (!exists) {
                this.logger.info(`Entry point at ${indexFileName} doesn't exist. Skipping prewarming...`);
                return;
            }
            this.logger.info("About to get: " + bundleURL);
            return request_1.Request.request(bundleURL, true)
                .then(() => {
                this.logger.warning("The Bundle Cache was prewarmed.");
            });
        })
            .catch(() => {
            // The attempt to prefetch the bundle failed. This may be because the bundle has
            // a different name that the one we guessed so we shouldn't treat this as fatal.
        });
    }
    start(runAs, resetCache = false) {
        let executedStartPackagerCmd = false;
        return this.isRunning()
            .then(running => {
            if (!running) {
                executedStartPackagerCmd = true;
                return this.monkeyPatchOpnForRNPackager()
                    .then(() => {
                    let args = ["--port", this.port.toString()];
                    if (resetCache) {
                        args = args.concat("--resetCache");
                    }
                    if (runAs !== PackagerRunAs.EXPONENT) {
                        return args;
                    }
                    args.push("--root", path.relative(this.projectPath, path.resolve(this.workspacePath, ".vscode")));
                    let helper = new exponentHelper_1.ExponentHelper(this.workspacePath, this.projectPath);
                    return helper.getExpPackagerOptions()
                        .then((options) => {
                        Object.keys(options).forEach(key => {
                            args = args.concat([`--${key}`, options[key]]);
                        });
                        // Patch for CRNA
                        if (args.indexOf("--assetExts") === -1) {
                            args.push("--assetExts", "ttf");
                        }
                        return args;
                    })
                        .catch(() => {
                        this.logger.warning("Couldn't read packager's options from exp.json, continue...");
                        return args;
                    });
                })
                    .then((args) => {
                    const projectRoot = settingsHelper_1.SettingsHelper.getReactNativeProjectRoot(this.workspacePath);
                    reactNativeProjectHelper_1.ReactNativeProjectHelper.getReactNativeVersion(projectRoot).then(version => {
                        //  There is a bug with launching VSCode editor for file from stack frame in 0.38, 0.39, 0.40 versions:
                        //  https://github.com/facebook/react-native/commit/f49093f39710173620fead6230d62cc670570210
                        //  This bug will be fixed in 0.41
                        const failedRNVersions = ["0.38.0", "0.39.0", "0.40.0"];
                        let reactEnv = Object.assign({}, process.env, {
                            REACT_DEBUGGER: "echo A debugger is not needed: ",
                            REACT_EDITOR: failedRNVersions.indexOf(version) < 0 ? "code" : this.openFileAtLocationCommand(),
                        });
                        this.logger.info("Starting Packager");
                        // The packager will continue running while we debug the application, so we can"t
                        // wait for this command to finish
                        let spawnOptions = { env: reactEnv };
                        const packagerSpawnResult = new commandExecutor_1.CommandExecutor(this.projectPath, this.logger).spawnReactPackager(args, spawnOptions);
                        this.packagerProcess = packagerSpawnResult.spawnedProcess;
                        packagerSpawnResult.outcome.done(() => { }, () => { }); /* Q prints a warning if we don't call .done().
                                                                                We ignore all outcome errors */
                        return packagerSpawnResult.startup;
                    });
                });
            }
            return void 0;
        })
            .then(() => this.awaitStart())
            .then(() => {
            if (executedStartPackagerCmd) {
                this.logger.info("Packager started.");
                this.packagerRunningAs = runAs;
            }
            else {
                this.logger.info("Packager is already running.");
                if (!this.packagerProcess) {
                    this.logger.warning(errorHelper_1.ErrorHelper.getWarning("React Native Packager running outside of VS Code. If you want to debug please use the 'Attach to packager' option"));
                }
            }
        });
    }
    awaitStart(retryCount = 30, delay = 2000) {
        let pu = new promise_1.PromiseUtil();
        return pu.retryAsync(() => this.isRunning(), (running) => running, retryCount, delay, "Could not start the packager.");
    }
    findOpnPackage() {
        try {
            let flatDependencyPackagePath = path.resolve(this.projectPath, Packager.NODE_MODULES_FODLER_NAME, Packager.OPN_PACKAGE_NAME, Packager.OPN_PACKAGE_MAIN_FILENAME);
            let nestedDependencyPackagePath = path.resolve(this.projectPath, Packager.NODE_MODULES_FODLER_NAME, Packager.REACT_NATIVE_PACKAGE_NAME, Packager.NODE_MODULES_FODLER_NAME, Packager.OPN_PACKAGE_NAME, Packager.OPN_PACKAGE_MAIN_FILENAME);
            let fsHelper = new node_1.Node.FileSystem();
            // Attempt to find the 'opn' package directly under the project's node_modules folder (node4 +)
            // Else, attempt to find the package within the dependent node_modules of react-native package
            let possiblePaths = [flatDependencyPackagePath, nestedDependencyPackagePath];
            return Q.any(possiblePaths.map(fsPath => fsHelper.exists(fsPath).then(exists => exists
                ? Q.resolve(fsPath)
                : Q.reject("opn package location not found"))));
        }
        catch (err) {
            return Q.reject("The package 'opn' was not found. " + err);
        }
    }
    monkeyPatchOpnForRNPackager() {
        let opnPackage;
        let destnFilePath;
        // Finds the 'opn' package
        return this.findOpnPackage()
            .then((opnIndexFilePath) => {
            destnFilePath = opnIndexFilePath;
            // Read the package's "package.json"
            opnPackage = new package_1.Package(path.resolve(path.dirname(destnFilePath)));
            return opnPackage.parsePackageInformation();
        }).then((packageJson) => {
            if (packageJson.main !== Packager.JS_INJECTOR_FILENAME) {
                // Copy over the patched 'opn' main file
                return new node_1.Node.FileSystem().copyFile(Packager.JS_INJECTOR_FILEPATH, path.resolve(path.dirname(destnFilePath), Packager.JS_INJECTOR_FILENAME))
                    .then(() => {
                    // Write/over-write the "main" attribute with the new file
                    return opnPackage.setMainFile(Packager.JS_INJECTOR_FILENAME);
                });
            }
            return Q.resolve(void 0);
        });
    }
    killPackagerProcess() {
        this.logger.info("Stopping Packager");
        return new commandExecutor_1.CommandExecutor(this.projectPath, this.logger).killReactPackager(this.packagerProcess).then(() => {
            this.packagerProcess = undefined;
            if (this.packagerRunningAs === PackagerRunAs.EXPONENT) {
                this.logger.info("Stopping Exponent");
                return XDL.stopAll(this.projectPath)
                    .then(() => this.logger.info("Exponent Stopped"));
            }
            return Q.resolve(void 0);
        });
    }
    openFileAtLocationCommand() {
        let atomScript = "node " + path.join(__dirname, "..", "..", "scripts", "atom");
        //  shell-quote package incorrectly parses windows paths
        //  https://github.com/facebook/react-native/blob/master/local-cli/server/util/launchEditor.js#L83
        if (process.platform === "win32") {
            return atomScript.replace(/\\/g, "/");
        }
        return atomScript;
    }
}
Packager.DEFAULT_PORT = 8081;
Packager.JS_INJECTOR_FILENAME = "opn-main.js";
Packager.JS_INJECTOR_FILEPATH = path.resolve(path.dirname(path.dirname(__dirname)), "js-patched", Packager.JS_INJECTOR_FILENAME);
Packager.NODE_MODULES_FODLER_NAME = "node_modules";
Packager.OPN_PACKAGE_NAME = "opn";
Packager.REACT_NATIVE_PACKAGE_NAME = "react-native";
Packager.OPN_PACKAGE_MAIN_FILENAME = "index.js";
exports.Packager = Packager;

//# sourceMappingURL=packager.js.map
