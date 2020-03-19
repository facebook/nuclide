// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("inversify");
const path = require("path");
const semver_1 = require("semver");
let NugetService = class NugetService {
    isReleaseVersion(version) {
        return version.prerelease.length === 0;
    }
    getVersionFromPackageFileName(packageName) {
        const ext = path.extname(packageName);
        const versionWithExt = packageName.substring(packageName.indexOf('.') + 1);
        const version = versionWithExt.substring(0, versionWithExt.length - ext.length);
        // Take only the first 3 parts.
        const parts = version.split('.');
        const semverParts = parts.filter((_, index) => index <= 2).join('.');
        const lastParts = parts.filter((_, index) => index === 3).join('.');
        const suffix = lastParts.length === 0 ? '' : `-${lastParts}`;
        const fixedVersion = `${semverParts}${suffix}`;
        return semver_1.parse(fixedVersion, true) || new semver_1.SemVer('0.0.0');
    }
};
NugetService = __decorate([
    inversify_1.injectable()
], NugetService);
exports.NugetService = NugetService;
//# sourceMappingURL=nugetService.js.map