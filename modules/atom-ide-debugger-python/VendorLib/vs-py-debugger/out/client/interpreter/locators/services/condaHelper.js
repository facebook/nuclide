"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
require("../../../common/extensions");
const conda_1 = require("./conda");
/**
 * Helpers for conda.
 */
class CondaHelper {
    /**
     * Return the string to display for the conda interpreter.
     */
    getDisplayName(condaInfo = {}) {
        // Samples.
        // "3.6.1 |Anaconda 4.4.0 (64-bit)| (default, May 11 2017, 13:25:24) [MSC v.1900 64 bit (AMD64)]".
        // "3.6.2 |Anaconda, Inc.| (default, Sep 21 2017, 18:29:43) \n[GCC 4.2.1 Compatible Clang 4.0.1 (tags/RELEASE_401/final)]".
        const sysVersion = condaInfo['sys.version'];
        if (!sysVersion) {
            return conda_1.AnacondaDisplayName;
        }
        // Take the second part of the sys.version.
        const sysVersionParts = sysVersion.split('|', 2);
        if (sysVersionParts.length === 2) {
            const displayName = sysVersionParts[1].trim();
            if (this.isIdentifiableAsAnaconda(displayName)) {
                return displayName;
            }
            else {
                return `${displayName} : ${conda_1.AnacondaDisplayName}`;
            }
        }
        else {
            return conda_1.AnacondaDisplayName;
        }
    }
    /**
     * Parses output returned by the command `conda env list`.
     * Sample output is as follows:
     * # conda environments:
     * #
     * base                  *  /Users/donjayamanne/anaconda3
     * one                      /Users/donjayamanne/anaconda3/envs/one
     * one two                  /Users/donjayamanne/anaconda3/envs/one two
     * py27                     /Users/donjayamanne/anaconda3/envs/py27
     * py36                     /Users/donjayamanne/anaconda3/envs/py36
     * three                    /Users/donjayamanne/anaconda3/envs/three
     * @param {string} condaEnvironmentList
     * @param {CondaInfo} condaInfo
     * @returns {{ name: string, path: string }[] | undefined}
     * @memberof CondaHelper
     */
    parseCondaEnvironmentNames(condaEnvironmentList) {
        const environments = condaEnvironmentList.splitLines({ trim: false });
        const baseEnvironmentLine = environments.filter(line => line.indexOf('*') > 0);
        if (baseEnvironmentLine.length === 0) {
            return;
        }
        const pathStartIndex = baseEnvironmentLine[0].indexOf(baseEnvironmentLine[0].split('*')[1].trim());
        const envs = [];
        environments.forEach(line => {
            if (line.length <= pathStartIndex) {
                return;
            }
            let name = line.substring(0, pathStartIndex).trim();
            if (name.endsWith('*')) {
                name = name.substring(0, name.length - 1).trim();
            }
            const envPath = line.substring(pathStartIndex).trim();
            name = name.length === 0 ? path.basename(envPath) : name;
            if (name.length > 0 && envPath.length > 0) {
                envs.push({ name, path: envPath });
            }
        });
        return envs;
    }
    /**
     * Does the given string match a known Anaconda identifier.
     */
    isIdentifiableAsAnaconda(value) {
        const valueToSearch = value.toLowerCase();
        return conda_1.AnacondaIdentfiers.some(item => valueToSearch.indexOf(item.toLowerCase()) !== -1);
    }
}
exports.CondaHelper = CondaHelper;
//# sourceMappingURL=condaHelper.js.map