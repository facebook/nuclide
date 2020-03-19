"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const Q = require("q");
const errorHelper_1 = require("../../common/error/errorHelper");
const plistBuddy_1 = require("./plistBuddy");
const OutputChannelLogger_1 = require("../log/OutputChannelLogger");
const fileSystem_1 = require("../../common/node/fileSystem");
const childProcess_1 = require("../../common/node/childProcess");
const telemetryHelper_1 = require("../../common/telemetryHelper");
class SimulatorPlist {
    constructor(projectRoot, { nodeFileSystem = new fileSystem_1.FileSystem(), plistBuddy = new plistBuddy_1.PlistBuddy(), nodeChildProcess = new childProcess_1.ChildProcess(), } = {}) {
        this.logger = OutputChannelLogger_1.OutputChannelLogger.getMainChannel();
        this.projectRoot = projectRoot;
        this.nodeFileSystem = nodeFileSystem;
        this.plistBuddy = plistBuddy;
        this.nodeChildProcess = nodeChildProcess;
    }
    findPlistFile() {
        return Q.all([
            this.plistBuddy.getBundleId(this.projectRoot),
            this.nodeChildProcess.exec("xcrun simctl getenv booted HOME").outcome,
        ]).spread((bundleId, pathBuffer) => {
            const pathBefore = path.join(pathBuffer.toString().trim(), "Containers", "Data", "Application");
            const pathAfter = path.join("Library", "Preferences", `${bundleId}.plist`);
            // Look through $SIMULATOR_HOME/Containers/Data/Application/*/Library/Preferences to find $BUNDLEID.plist
            return this.nodeFileSystem.readDir(pathBefore).then((apps) => {
                this.logger.info(`About to search for plist in base folder: ${pathBefore} pathAfter: ${pathAfter} in each of the apps: ${apps}`);
                const plistCandidates = apps.map((app) => path.join(pathBefore, app, pathAfter)).filter(filePath => this.nodeFileSystem.existsSync(filePath));
                if (plistCandidates.length === 0) {
                    throw new Error(`Unable to find plist file for ${bundleId}`);
                }
                else if (plistCandidates.length > 1) {
                    telemetryHelper_1.TelemetryHelper.sendSimpleEvent("multipleDebugPlistFound");
                    this.logger.warning(errorHelper_1.ErrorHelper.getWarning("Multiple plist candidates found. Application may not be in debug mode."));
                }
                return plistCandidates[0];
            });
        });
    }
}
exports.SimulatorPlist = SimulatorPlist;

//# sourceMappingURL=simulatorPlist.js.map
