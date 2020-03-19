"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const Q = require("q");
const fs = require("fs");
const packager_1 = require("../common/packager");
const packagerStatusIndicator_1 = require("./packagerStatusIndicator");
const settingsHelper_1 = require("./settingsHelper");
const OutputChannelLogger_1 = require("./log/OutputChannelLogger");
class GeneralMobilePlatform {
    constructor(runOptions, platformDeps = {}) {
        this.runOptions = runOptions;
        this.platformName = this.runOptions.platform;
        this.projectPath = this.runOptions.projectRoot;
        // BEGIN MODIFIED BY PELMERS
        this.packager = platformDeps.packager || new packager_1.Packager("", this.projectPath, settingsHelper_1.SettingsHelper.getPackagerPort(this.projectPath));
        // END MODIFIED BY PELMERS
        this.logger = OutputChannelLogger_1.OutputChannelLogger.getChannel(`React Native: Run ${this.platformName}`, true);
        this.logger.clear();
    }
    runApp() {
        this.logger.info("Connected to packager. You can now open your app in the simulator.");
        return Q.resolve(void 0);
    }
    enableJSDebuggingMode() {
        this.logger.info("Debugger ready. Enable remote debugging in app.");
        return Q.resolve(void 0);
    }
    disableJSDebuggingMode() {
        this.logger.info("Debugger ready. Disable remote debugging in app.");
        return Q.resolve(void 0);
    }
    startPackager() {
        this.logger.info("Starting React Native Packager.");
        return this.packager.isRunning().then((running) => {
            if (running) {
                if (this.packager.getRunningAs() !== packager_1.PackagerRunAs.REACT_NATIVE) {
                    return this.packager.stop().then(() => this.packager.statusIndicator.updatePackagerStatus(packagerStatusIndicator_1.PackagerStatus.PACKAGER_STOPPED));
                }
                this.logger.info("Attaching to running React Native packager");
            }
            return void 0;
        })
            .then(() => {
            return this.packager.startAsReactNative();
        })
            .then(() => this.packager.statusIndicator.updatePackagerStatus(packagerStatusIndicator_1.PackagerStatus.PACKAGER_STARTED));
    }
    prewarmBundleCache() {
        // generalMobilePlatform should do nothing here. Method should be overriden by children for specific behavior.
        return Q.resolve(void 0);
    }
    getRunArgument() {
        throw new Error("Not yet implemented: GeneralMobilePlatform.getRunArgument");
    }
    getEnvArgument() {
        let args = this.runOptions;
        let env = process.env;
        if (args.envFile) {
            let buffer = fs.readFileSync(args.envFile, "utf8");
            // Strip BOM
            if (buffer && buffer[0] === "\uFEFF") {
                buffer = buffer.substr(1);
            }
            buffer.split("\n").forEach((line) => {
                const r = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);
                if (r !== null) {
                    const key = r[1];
                    if (!env[key]) {
                        let value = r[2] || "";
                        if (value.length > 0 && value.charAt(0) === "\"" && value.charAt(value.length - 1) === "\"") {
                            value = value.replace(/\\n/gm, "\n");
                        }
                        env[key] = value.replace(/(^['"]|['"]$)/g, "");
                    }
                }
            });
        }
        if (args.env) {
            // launch config env vars overwrite .env vars
            for (let key in args.env) {
                if (args.env.hasOwnProperty(key)) {
                    env[key] = args.env[key];
                }
            }
        }
        return env;
    }
}
GeneralMobilePlatform.deviceString = "device";
GeneralMobilePlatform.simulatorString = "simulator";
GeneralMobilePlatform.NO_PACKAGER_VERSION = "0.42.0";
exports.GeneralMobilePlatform = GeneralMobilePlatform;

//# sourceMappingURL=generalMobilePlatform.js.map
