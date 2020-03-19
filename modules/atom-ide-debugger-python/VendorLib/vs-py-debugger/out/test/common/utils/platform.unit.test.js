// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const semver = require("semver");
const platform_1 = require("../../../client/common/utils/platform");
const version_1 = require("../../../client/common/utils/version");
const stub_1 = require("../../stub");
// Windows
exports.WIN_10 = new platform_1.Info(platform_1.OSType.Windows, 'x64', new semver.SemVer('10.0.1'));
exports.WIN_7 = new platform_1.Info(platform_1.OSType.Windows, 'x64', new semver.SemVer('6.1.3'));
exports.WIN_XP = new platform_1.Info(platform_1.OSType.Windows, 'x64', new semver.SemVer('5.1.7'));
// OS X
exports.MAC_HIGH_SIERRA = new platform_1.Info(platform_1.OSType.OSX, 'x64', new semver.SemVer('10.13.1'));
exports.MAC_SIERRA = new platform_1.Info(platform_1.OSType.OSX, 'x64', new semver.SemVer('10.12.2'));
exports.MAC_EL_CAPITAN = new platform_1.Info(platform_1.OSType.OSX, 'x64', new semver.SemVer('10.11.5'));
// Linux
exports.UBUNTU_BIONIC = new platform_1.Info(platform_1.OSType.Linux, 'x64', version_1.parseVersion('18.04'), 
//semver.coerce('18.04') || new semver.SemVer('0.0.0'),
platform_1.OSDistro.Ubuntu);
exports.UBUNTU_PRECISE = new platform_1.Info(platform_1.OSType.Linux, 'x64', version_1.parseVersion('14.04'), 
//semver.coerce('14.04') || new semver.SemVer('0.0.0'),
platform_1.OSDistro.Ubuntu);
exports.FEDORA = new platform_1.Info(platform_1.OSType.Linux, 'x64', version_1.parseVersion('24'), 
//semver.coerce('24') || new semver.SemVer('0.0.0'),
platform_1.OSDistro.Fedora);
exports.ARCH = new platform_1.Info(platform_1.OSType.Linux, 'x64', new semver.SemVer('0.0.0'), // rolling vs. 2018.08.01
platform_1.OSDistro.Arch);
exports.OLD = new platform_1.Info(platform_1.OSType.Windows, 'x86', new semver.SemVer('5.1.7'));
class StubDeps {
    constructor(stub = new stub_1.Stub()) {
        this.stub = stub;
        this.returnGetArch = '';
        this.returnGetRelease = '';
        this.returnGetLinuxDistro = [platform_1.OSDistro.Unknown, new semver.SemVer('0.0.0')];
    }
    getArch() {
        this.stub.addCall('getArch');
        this.stub.maybeErr();
        return this.returnGetArch;
    }
    getRelease() {
        this.stub.addCall('getRelease');
        this.stub.maybeErr();
        return this.returnGetRelease;
    }
    getLinuxDistro() {
        this.stub.addCall('getLinuxDistro');
        this.stub.maybeErr();
        return this.returnGetLinuxDistro;
    }
}
suite('OS Info - getInfo()', () => {
    let stub;
    let deps;
    setup(() => {
        stub = new stub_1.Stub();
        deps = new StubDeps(stub);
    });
    const NOT_LINUX = [platform_1.OSDistro.Unknown, ''];
    const tests = [
        ['windows', 'x64', '10.0.1', NOT_LINUX, exports.WIN_10],
        ['windows', 'x64', '6.1.3', NOT_LINUX, exports.WIN_7],
        ['windows', 'x64', '5.1.7', NOT_LINUX, exports.WIN_XP],
        ['darwin', 'x64', '10.13.1', NOT_LINUX, exports.MAC_HIGH_SIERRA],
        ['darwin', 'x64', '10.12.2', NOT_LINUX, exports.MAC_SIERRA],
        ['darwin', 'x64', '10.11.5', NOT_LINUX, exports.MAC_EL_CAPITAN],
        ['linux', 'x64', '4.1.4', [platform_1.OSDistro.Ubuntu, '18.04'], exports.UBUNTU_BIONIC],
        ['linux', 'x64', '4.1.4', [platform_1.OSDistro.Ubuntu, '14.04'], exports.UBUNTU_PRECISE],
        ['linux', 'x64', '4.1.4', [platform_1.OSDistro.Fedora, '24'], exports.FEDORA],
        ['linux', 'x64', '4.1.4', [platform_1.OSDistro.Arch, ''], exports.ARCH],
        ['windows', 'x86', '5.1.7', NOT_LINUX, exports.OLD] // WinXP
    ];
    let i = 0;
    for (const [platform, arch, release, [distro, version], expected] of tests) {
        test(`${i} - ${platform} ${arch} ${release}`, () => __awaiter(this, void 0, void 0, function* () {
            deps.returnGetArch = arch;
            deps.returnGetRelease = release;
            deps.returnGetLinuxDistro = [distro, version_1.parseVersion(version)];
            const result = platform_1.getInfo(() => deps.getArch(), () => deps.getRelease(), () => deps.getLinuxDistro(), platform);
            chai_1.expect(result).to.deep.equal(expected);
            if (distro === platform_1.OSDistro.Unknown) {
                stub.checkCalls([
                    { funcName: 'getArch', args: [] },
                    { funcName: 'getRelease', args: [] }
                ]);
            }
            else {
                stub.checkCalls([
                    { funcName: 'getArch', args: [] },
                    { funcName: 'getLinuxDistro', args: [] }
                ]);
            }
        }));
        i = i + 1;
    }
});
suite('OS Info - getOSType()', () => {
    const tests = [
        ['windows', platform_1.OSType.Windows],
        ['darwin', platform_1.OSType.OSX],
        ['linux', platform_1.OSType.Linux],
        ['win32', platform_1.OSType.Windows],
        ['darwin ++', platform_1.OSType.OSX],
        ['linux!', platform_1.OSType.Linux]
    ];
    for (const [platform, expected] of tests) {
        test(`platform: ${platform}`, () => __awaiter(this, void 0, void 0, function* () {
            const result = platform_1.getOSType(platform);
            chai_1.expect(result).to.be.equal(expected);
        }));
    }
});
// tslint:disable-next-line:max-func-body-length
suite('OS Info - helpers', () => {
    test('isWindows', () => __awaiter(this, void 0, void 0, function* () {
        for (const info of [exports.WIN_10]) {
            const result = platform_1.isWindows(info);
            chai_1.expect(result).to.be.equal(true, 'invalid value');
        }
        for (const info of [exports.MAC_HIGH_SIERRA, exports.UBUNTU_BIONIC, exports.FEDORA]) {
            const result = platform_1.isWindows(info);
            chai_1.expect(result).to.be.equal(false, 'invalid value');
        }
    }));
    test('isMac', () => __awaiter(this, void 0, void 0, function* () {
        for (const info of [exports.MAC_HIGH_SIERRA]) {
            const result = platform_1.isMac(info);
            chai_1.expect(result).to.be.equal(true, 'invalid value');
        }
        for (const info of [exports.WIN_10, exports.UBUNTU_BIONIC, exports.FEDORA]) {
            const result = platform_1.isMac(info);
            chai_1.expect(result).to.be.equal(false, 'invalid value');
        }
    }));
    test('isLinux', () => __awaiter(this, void 0, void 0, function* () {
        for (const info of [exports.UBUNTU_BIONIC, exports.FEDORA]) {
            const result = platform_1.isLinux(info);
            chai_1.expect(result).to.be.equal(true, 'invalid value');
        }
        for (const info of [exports.WIN_10, exports.MAC_HIGH_SIERRA]) {
            const result = platform_1.isLinux(info);
            chai_1.expect(result).to.be.equal(false, 'invalid value');
        }
    }));
    test('is64bit', () => __awaiter(this, void 0, void 0, function* () {
        const result1 = platform_1.is64bit(exports.WIN_10);
        const result2 = platform_1.is64bit(exports.OLD);
        chai_1.expect(result1).to.be.equal(true, 'invalid value');
        chai_1.expect(result2).to.be.equal(false, 'invalid value');
    }));
    test('matchPlatform - any', () => __awaiter(this, void 0, void 0, function* () {
        const cases = [
            ['', exports.WIN_10, true],
            ['', exports.MAC_HIGH_SIERRA, true],
            ['', exports.UBUNTU_BIONIC, true],
            ['', exports.FEDORA, true],
            ['', exports.ARCH, true]
        ];
        for (const [names, info, expected] of cases) {
            const result = platform_1.matchPlatform(names, info);
            chai_1.expect(result).to.be.equal(expected);
        }
    }));
    test('matchPlatform - Windows', () => __awaiter(this, void 0, void 0, function* () {
        const cases = [
            ['win', exports.WIN_10, true],
            ['win', exports.MAC_HIGH_SIERRA, false],
            ['win', exports.UBUNTU_BIONIC, false],
            ['win', exports.FEDORA, false],
            ['win', exports.ARCH, false],
            ['-win', exports.WIN_10, false],
            ['-win', exports.MAC_HIGH_SIERRA, true],
            ['-win', exports.UBUNTU_BIONIC, true],
            ['-win', exports.FEDORA, true],
            ['-win', exports.ARCH, true]
        ];
        for (const [names, info, expected] of cases) {
            const result = platform_1.matchPlatform(names, info);
            chai_1.expect(result).to.be.equal(expected);
        }
    }));
    test('matchPlatform - OSX', () => __awaiter(this, void 0, void 0, function* () {
        const cases = [
            ['osx', exports.MAC_HIGH_SIERRA, true],
            ['mac', exports.MAC_HIGH_SIERRA, true],
            ['osx', exports.WIN_10, false],
            ['osx', exports.UBUNTU_BIONIC, false],
            ['osx', exports.FEDORA, false],
            ['osx', exports.ARCH, false],
            ['-osx', exports.MAC_HIGH_SIERRA, false],
            ['-mac', exports.MAC_HIGH_SIERRA, false],
            ['-osx', exports.WIN_10, true],
            ['-osx', exports.UBUNTU_BIONIC, true],
            ['-osx', exports.FEDORA, true],
            ['-osx', exports.ARCH, true]
        ];
        for (const [names, info, expected] of cases) {
            const result = platform_1.matchPlatform(names, info);
            chai_1.expect(result).to.be.equal(expected);
        }
    }));
    test('matchPlatform - Linux', () => __awaiter(this, void 0, void 0, function* () {
        const cases = [
            ['linux', exports.UBUNTU_BIONIC, true],
            ['linux', exports.FEDORA, true],
            ['linux', exports.ARCH, true],
            ['linux', exports.WIN_10, false],
            ['linux', exports.MAC_HIGH_SIERRA, false],
            ['-linux', exports.UBUNTU_BIONIC, false],
            ['-linux', exports.FEDORA, false],
            ['-linux', exports.ARCH, false],
            ['-linux', exports.WIN_10, true],
            ['-linux', exports.MAC_HIGH_SIERRA, true]
        ];
        for (const [names, info, expected] of cases) {
            const result = platform_1.matchPlatform(names, info);
            chai_1.expect(result).to.be.equal(expected, `${names} ${info.type} ${info.distro}`);
        }
    }));
    test('matchPlatform - ubuntu', () => __awaiter(this, void 0, void 0, function* () {
        const cases = [
            ['ubuntu', exports.UBUNTU_BIONIC, true],
            ['ubuntu', exports.FEDORA, false],
            ['ubuntu', exports.ARCH, false],
            ['ubuntu', exports.WIN_10, false],
            ['ubuntu', exports.MAC_HIGH_SIERRA, false],
            ['-ubuntu', exports.UBUNTU_BIONIC, false],
            ['-ubuntu', exports.FEDORA, true],
            ['-ubuntu', exports.ARCH, true],
            ['-ubuntu', exports.WIN_10, true],
            ['-ubuntu', exports.MAC_HIGH_SIERRA, true]
        ];
        for (const [names, info, expected] of cases) {
            const result = platform_1.matchPlatform(names, info);
            chai_1.expect(result).to.be.equal(expected, `${names} ${info.type} ${info.distro}`);
        }
    }));
    test('matchPlatform - fedora', () => __awaiter(this, void 0, void 0, function* () {
        const cases = [
            ['fedora', exports.FEDORA, true],
            ['fedora', exports.UBUNTU_BIONIC, false],
            ['fedora', exports.ARCH, false],
            ['fedora', exports.WIN_10, false],
            ['fedora', exports.MAC_HIGH_SIERRA, false],
            ['-fedora', exports.FEDORA, false],
            ['-fedora', exports.UBUNTU_BIONIC, true],
            ['-fedora', exports.ARCH, true],
            ['-fedora', exports.WIN_10, true],
            ['-fedora', exports.MAC_HIGH_SIERRA, true]
        ];
        for (const [names, info, expected] of cases) {
            const result = platform_1.matchPlatform(names, info);
            chai_1.expect(result).to.be.equal(expected, `${names} ${info.type} ${info.distro}`);
        }
    }));
    test('matchPlatform - arch', () => __awaiter(this, void 0, void 0, function* () {
        const cases = [
            ['arch', exports.ARCH, true],
            ['arch', exports.UBUNTU_BIONIC, false],
            ['arch', exports.FEDORA, false],
            ['arch', exports.WIN_10, false],
            ['arch', exports.MAC_HIGH_SIERRA, false],
            ['-arch', exports.ARCH, false],
            ['-arch', exports.UBUNTU_BIONIC, true],
            ['-arch', exports.FEDORA, true],
            ['-arch', exports.WIN_10, true],
            ['-arch', exports.MAC_HIGH_SIERRA, true]
        ];
        for (const [names, info, expected] of cases) {
            const result = platform_1.matchPlatform(names, info);
            chai_1.expect(result).to.be.equal(expected, `${names} ${info.type} ${info.distro}`);
        }
    }));
    test('matchPlatform - multi', () => __awaiter(this, void 0, void 0, function* () {
        function runTest(names, cases) {
            for (const [info, expected] of cases) {
                const result = platform_1.matchPlatform(names, info);
                chai_1.expect(result).to.be.equal(expected);
            }
        }
        runTest('win|osx|linux', [
            [exports.WIN_10, true],
            [exports.MAC_HIGH_SIERRA, true],
            [exports.UBUNTU_BIONIC, true],
            [exports.ARCH, true]
        ]);
        runTest('win|osx', [
            [exports.WIN_10, true],
            [exports.MAC_HIGH_SIERRA, true],
            [exports.UBUNTU_BIONIC, false],
            [exports.ARCH, false]
        ]);
        runTest('osx|linux', [
            [exports.WIN_10, false],
            [exports.MAC_HIGH_SIERRA, true],
            [exports.UBUNTU_BIONIC, true],
            [exports.ARCH, true]
        ]);
    }));
});
//# sourceMappingURL=platform.unit.test.js.map