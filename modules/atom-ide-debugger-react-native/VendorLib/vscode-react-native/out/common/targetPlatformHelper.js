"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const os = require("os");
const errorHelper_1 = require("./error/errorHelper");
const hostPlatform_1 = require("./hostPlatform");
const internalErrorCode_1 = require("./error/internalErrorCode");
/**
 * Defines the identifiers of all the mobile target platforms React Native supports.
 */
var TargetPlatformId;
(function (TargetPlatformId) {
    TargetPlatformId[TargetPlatformId["ANDROID"] = 0] = "ANDROID";
    TargetPlatformId[TargetPlatformId["IOS"] = 1] = "IOS";
    TargetPlatformId[TargetPlatformId["EXPONENT"] = 2] = "EXPONENT";
})(TargetPlatformId = exports.TargetPlatformId || (exports.TargetPlatformId = {}));
class TargetPlatformHelper {
    /**
     * Return the target platform identifier for a platform with name {platformName}.
     */
    static getTargetPlatformId(platformName) {
        switch (platformName.toLowerCase()) {
            case "android":
                return TargetPlatformId.ANDROID;
            case "ios":
                return TargetPlatformId.IOS;
            case "exponent":
                return TargetPlatformId.EXPONENT;
            default:
                throw new Error(`The target platform ${platformName} is not supported.`);
        }
    }
    /**
     * Checks whether the current host platform supports the target mobile platform.
     */
    static checkTargetPlatformSupport(platformName) {
        let targetPlatformId = TargetPlatformHelper.getTargetPlatformId(platformName);
        try {
            if (!hostPlatform_1.HostPlatform.isCompatibleWithTarget(targetPlatformId)) {
                throw errorHelper_1.ErrorHelper.getInternalError(internalErrorCode_1.InternalErrorCode.PlatformNotSupported, platformName, os.platform());
            }
        }
        catch (e) {
            /* we throw in the case of an invalid target platform */
            throw errorHelper_1.ErrorHelper.getNestedError(e, internalErrorCode_1.InternalErrorCode.PlatformNotSupported, platformName, os.platform());
        }
    }
}
exports.TargetPlatformHelper = TargetPlatformHelper;

//# sourceMappingURL=targetPlatformHelper.js.map
