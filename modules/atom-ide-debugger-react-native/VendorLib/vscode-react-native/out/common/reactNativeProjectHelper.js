"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const Q = require("q");
const fs = require("fs");
const path = require("path");
const commandExecutor_1 = require("./commandExecutor");
class ReactNativeProjectHelper {
    static getReactNativeVersion(projectRoot) {
        return new commandExecutor_1.CommandExecutor(projectRoot).getReactNativeVersion();
    }
    /**
     * Ensures that we are in a React Native project
     * Otherwise, displays an error message banner
     */
    static isReactNativeProject(projectRoot) {
        if (!projectRoot || !fs.existsSync(path.join(projectRoot, "package.json"))) {
            return Q(false);
        }
        return this.getReactNativeVersion(projectRoot)
            .then(version => {
            return !!(version);
        });
    }
    static isHaulProject(projectRoot) {
        if (!projectRoot || !fs.existsSync(path.join(projectRoot, "package.json"))) {
            return false;
        }
        const packageJson = require(path.join(projectRoot, "package.json"));
        const haulVersion = packageJson.devDependencies && packageJson.devDependencies.haul;
        return !!haulVersion;
    }
}
exports.ReactNativeProjectHelper = ReactNativeProjectHelper;

//# sourceMappingURL=reactNativeProjectHelper.js.map
