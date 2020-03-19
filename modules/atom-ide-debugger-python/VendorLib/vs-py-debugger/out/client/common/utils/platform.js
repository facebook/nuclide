// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const getos = require("getos");
const os = require("os");
const semver = require("semver");
const version_1 = require("./version");
var Architecture;
(function (Architecture) {
    Architecture[Architecture["Unknown"] = 1] = "Unknown";
    Architecture[Architecture["x86"] = 2] = "x86";
    Architecture[Architecture["x64"] = 3] = "x64";
})(Architecture = exports.Architecture || (exports.Architecture = {}));
var OSType;
(function (OSType) {
    OSType[OSType["Unknown"] = 0] = "Unknown";
    OSType[OSType["Windows"] = 1] = "Windows";
    OSType[OSType["OSX"] = 2] = "OSX";
    OSType[OSType["Linux"] = 3] = "Linux";
})(OSType = exports.OSType || (exports.OSType = {}));
var OSDistro;
(function (OSDistro) {
    OSDistro[OSDistro["Unknown"] = 0] = "Unknown";
    // linux:
    OSDistro[OSDistro["Ubuntu"] = 1] = "Ubuntu";
    OSDistro[OSDistro["Debian"] = 2] = "Debian";
    OSDistro[OSDistro["RHEL"] = 3] = "RHEL";
    OSDistro[OSDistro["Fedora"] = 4] = "Fedora";
    OSDistro[OSDistro["CentOS"] = 5] = "CentOS";
    // The remainder aren't officially supported.
    // See: https://code.visualstudio.com/docs/supporting/requirements
    OSDistro[OSDistro["Suse"] = 6] = "Suse";
    OSDistro[OSDistro["Gentoo"] = 7] = "Gentoo";
    OSDistro[OSDistro["Arch"] = 8] = "Arch";
})(OSDistro = exports.OSDistro || (exports.OSDistro = {}));
let local;
function getLocal() {
    if (!local) {
        local = getInfo();
    }
    return local;
}
function getOSType(platform = process.platform) {
    if (/^win/.test(platform)) {
        return OSType.Windows;
    }
    else if (/^darwin/.test(platform)) {
        return OSType.OSX;
    }
    else if (/^linux/.test(platform)) {
        return OSType.Linux;
    }
    else {
        return OSType.Unknown;
    }
}
exports.getOSType = getOSType;
class Info {
    constructor(type, arch = os.arch(), 
    // See:
    //  https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/semver/index.d.ts#L152
    version = new semver.SemVer('0.0.0'), distro = OSDistro.Unknown) {
        this.type = type;
        this.arch = arch;
        this.version = version;
        this.distro = distro;
    }
    get architecture() {
        return this.arch === 'x64' ? Architecture.x64 : Architecture.x86;
    }
    matchPlatform(names) {
        return matchPlatform(names, this);
    }
}
exports.Info = Info;
function getInfo(getArch = os.arch, getRelease = os.release, getDistro = getLinuxDistro, platform) {
    const osType = getOSType(platform);
    const arch = getArch();
    switch (osType) {
        case OSType.Windows:
            return getDefaultInfo(osType, arch, getRelease);
        case OSType.OSX:
            return getDefaultInfo(osType, arch, getRelease);
        case OSType.Linux:
            return getLinuxInfo(arch, getDistro);
        default:
            return new Info(OSType.Unknown, arch);
    }
}
exports.getInfo = getInfo;
function getDefaultInfo(osType, arch, getRelease) {
    const version = version_1.parseVersion(getRelease());
    return new Info(osType, arch, version);
}
function getLinuxInfo(arch, getDistro) {
    const [distro, version] = getDistro();
    return new Info(OSType.Linux, arch, version, distro);
}
function getLinuxDistro() {
    let distro = OSDistro.Unknown;
    let version = new semver.SemVer('0.0.0');
    getos((exc, info) => {
        if (exc) {
            throw exc;
        }
        distro = getLinuxDistroFromName(info.dist);
        version = version_1.parseVersion(info.release);
    });
    return [distro, version];
}
function getLinuxDistroFromName(name) {
    name = name.toLowerCase();
    // See https://github.com/zyga/os-release-zoo.
    if (/ubuntu/.test(name)) {
        return OSDistro.Ubuntu;
    }
    else if (/debian/.test(name)) {
        return OSDistro.Debian;
    }
    else if (/rhel/.test(name) || /red hat/.test(name)) {
        return OSDistro.RHEL;
    }
    else if (/fedora/.test(name)) {
        return OSDistro.Fedora;
    }
    else if (/centos/.test(name)) {
        return OSDistro.CentOS;
    }
    // The remainder aren't officially supported by VS Code.
    if (/suse/.test(name)) {
        return OSDistro.Suse;
    }
    else if (/gentoo/.test(name)) {
        return OSDistro.Suse;
    }
    else if (/arch/.test(name)) {
        return OSDistro.Arch;
    }
    else {
        return OSDistro.Unknown;
    }
}
// helpers
function isWindows(info) {
    if (!info) {
        info = getLocal();
    }
    return info.type === OSType.Windows;
}
exports.isWindows = isWindows;
function isMac(info) {
    if (!info) {
        info = getLocal();
    }
    return info.type === OSType.OSX;
}
exports.isMac = isMac;
function isLinux(info) {
    if (!info) {
        info = getLocal();
    }
    return info.type === OSType.Linux;
}
exports.isLinux = isLinux;
function is64bit(info) {
    if (!info) {
        info = getLocal();
    }
    return info.architecture === Architecture.x64;
}
exports.is64bit = is64bit;
// Match the platform string to the given OS info.
function matchPlatform(names, info = getInfo()) {
    if (info.type === OSType.Unknown) {
        return false;
    }
    names = names.trim();
    if (names === '') {
        return true;
    }
    for (let name of names.split('|')) {
        name = name.trim();
        if (matchOnePlatform(name, info)) {
            return true;
        }
    }
    return false;
}
exports.matchPlatform = matchPlatform;
function matchOnePlatform(name, info) {
    if (name === '' || name === '-') {
        return false;
    }
    const negate = name[0] === '-';
    if (negate) {
        name = name.replace(/^-/, '');
    }
    const [osType, distro] = identifyOS(name);
    if (osType === OSType.Unknown) {
        return false;
    }
    let result = false;
    if (osType === info.type) {
        result = true;
        if (osType === OSType.Linux) {
            if (distro !== OSDistro.Unknown) {
                result = distro === info.distro;
            }
        }
    }
    return negate ? !result : result;
}
function identifyOS(name) {
    name = name.toLowerCase();
    if (/win/.test(name)) {
        return [OSType.Windows, OSDistro.Unknown];
    }
    else if (/darwin|mac|osx/.test(name)) {
        return [OSType.OSX, OSDistro.Unknown];
    }
    else if (/linux/.test(name)) {
        return [OSType.Linux, OSDistro.Unknown];
    }
    // Try linux distros.
    const distro = getLinuxDistroFromName(name);
    if (distro !== OSDistro.Unknown) {
        return [OSType.Linux, distro];
    }
    else {
        return [OSType.Unknown, OSDistro.Unknown];
    }
}
//# sourceMappingURL=platform.js.map