// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const semver = require("semver");
function parseVersion(raw) {
    raw = raw.replace(/\.00*(?=[1-9]|0\.)/, '.');
    const ver = semver.coerce(raw);
    if (ver === null || !semver.valid(ver)) {
        // tslint:disable-next-line: no-suspicious-comment
        // TODO: Raise an exception instead?
        return new semver.SemVer('0.0.0');
    }
    return ver;
}
exports.parseVersion = parseVersion;
function convertToSemver(version) {
    const versionParts = (version || '').split('.').filter(item => item.length > 0);
    while (versionParts.length < 3) {
        versionParts.push('0');
    }
    return versionParts.join('.');
}
exports.convertToSemver = convertToSemver;
function compareVersion(versionA, versionB) {
    try {
        versionA = convertToSemver(versionA);
        versionB = convertToSemver(versionB);
        return semver.gt(versionA, versionB) ? 1 : 0;
    }
    catch (_a) {
        return 0;
    }
}
exports.compareVersion = compareVersion;
//# sourceMappingURL=version.js.map