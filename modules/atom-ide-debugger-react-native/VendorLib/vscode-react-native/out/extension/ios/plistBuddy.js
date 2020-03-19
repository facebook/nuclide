"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const node_1 = require("../../common/node/node");
const xcodeproj_1 = require("./xcodeproj");
class PlistBuddy {
    constructor({ nodeChildProcess = new node_1.Node.ChildProcess(), xcodeproj = new xcodeproj_1.Xcodeproj(), } = {}) {
        this.nodeChildProcess = nodeChildProcess;
        this.xcodeproj = xcodeproj;
    }
    getBundleId(projectRoot, simulator = true) {
        return this.xcodeproj.findXcodeprojFile(projectRoot).then((projectFile) => {
            const infoPlistPath = path.join(projectRoot, "build", "Build", "Products", simulator ? "Debug-iphonesimulator" : "Debug-iphoneos", `${projectFile.projectName}.app`, "Info.plist");
            return this.invokePlistBuddy("Print:CFBundleIdentifier", infoPlistPath);
        });
    }
    setPlistProperty(plistFile, property, value) {
        // Attempt to set the value, and if it fails due to the key not existing attempt to create the key
        return this.invokePlistBuddy(`Set ${property} ${value}`, plistFile).fail(() => this.invokePlistBuddy(`Add ${property} string ${value}`, plistFile)).then(() => { });
    }
    setPlistBooleanProperty(plistFile, property, value) {
        // Attempt to set the value, and if it fails due to the key not existing attempt to create the key
        return this.invokePlistBuddy(`Set ${property} ${value}`, plistFile)
            .fail(() => this.invokePlistBuddy(`Add ${property} bool ${value}`, plistFile))
            .then(() => { });
    }
    deletePlistProperty(plistFile, property) {
        return this.invokePlistBuddy(`Delete ${property}`, plistFile).then(() => { });
    }
    readPlistProperty(plistFile, property) {
        return this.invokePlistBuddy(`Print ${property}`, plistFile);
    }
    invokePlistBuddy(command, plistFile) {
        return this.nodeChildProcess.exec(`${PlistBuddy.plistBuddyExecutable} -c '${command}' '${plistFile}'`).outcome.then((result) => {
            return result.toString().trim();
        });
    }
}
PlistBuddy.plistBuddyExecutable = "/usr/libexec/PlistBuddy";
exports.PlistBuddy = PlistBuddy;

//# sourceMappingURL=plistBuddy.js.map
