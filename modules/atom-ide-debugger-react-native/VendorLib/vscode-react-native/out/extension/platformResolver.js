"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const iOSPlatform_1 = require("./ios/iOSPlatform");
const androidPlatform_1 = require("./android/androidPlatform");
const generalMobilePlatform_1 = require("../extension/generalMobilePlatform");
const exponentPlatform_1 = require("./exponent/exponentPlatform");
class PlatformResolver {
    /**
     * Resolves the mobile application target platform.
     */
    resolveMobilePlatform(mobilePlatformString, runOptions, platformDeps) {
        switch (mobilePlatformString) {
            // We lazyly load the strategies, because some components might be
            // missing on some platforms (like XCode in Windows)
            case "ios":
                return new iOSPlatform_1.IOSPlatform(runOptions, platformDeps);
            case "android":
                return new androidPlatform_1.AndroidPlatform(runOptions, platformDeps);
            case "exponent":
                return new exponentPlatform_1.ExponentPlatform(runOptions, platformDeps);
            default:
                return new generalMobilePlatform_1.GeneralMobilePlatform(runOptions, platformDeps);
        }
    }
}
exports.PlatformResolver = PlatformResolver;

//# sourceMappingURL=platformResolver.js.map
