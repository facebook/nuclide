"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:no-unused-variable
const assert = require("assert");
const TypeMoq = require("typemoq");
const platformData_1 = require("../../client/activation/platformData");
const testDataWinMac = [
    { isWindows: true, is64Bit: true, expectedName: 'win-x64' },
    { isWindows: true, is64Bit: false, expectedName: 'win-x86' },
    { isWindows: false, is64Bit: true, expectedName: 'osx-x64' }
];
const testDataLinux = [
    { name: 'centos', expectedName: 'linux-x64' },
    { name: 'debian', expectedName: 'linux-x64' },
    { name: 'fedora', expectedName: 'linux-x64' },
    { name: 'ol', expectedName: 'linux-x64' },
    { name: 'opensuse', expectedName: 'linux-x64' },
    { name: 'rhel', expectedName: 'linux-x64' },
    { name: 'ubuntu', expectedName: 'linux-x64' }
];
const testDataModuleName = [
    { isWindows: true, isMac: false, isLinux: false, expectedName: platformData_1.PlatformLSExecutables.Windows },
    { isWindows: false, isMac: true, isLinux: false, expectedName: platformData_1.PlatformLSExecutables.MacOS },
    { isWindows: false, isMac: false, isLinux: true, expectedName: platformData_1.PlatformLSExecutables.Linux }
];
// tslint:disable-next-line:max-func-body-length
suite('Activation - platform data', () => {
    test('Name and hash (Windows/Mac)', () => __awaiter(this, void 0, void 0, function* () {
        for (const t of testDataWinMac) {
            const platformService = TypeMoq.Mock.ofType();
            platformService.setup(x => x.isWindows).returns(() => t.isWindows);
            platformService.setup(x => x.isMac).returns(() => !t.isWindows);
            platformService.setup(x => x.is64bit).returns(() => t.is64Bit);
            const fs = TypeMoq.Mock.ofType();
            const pd = new platformData_1.PlatformData(platformService.object, fs.object);
            const actual = yield pd.getPlatformName();
            assert.equal(actual, t.expectedName, `${actual} does not match ${t.expectedName}`);
            const actualHash = yield pd.getExpectedHash();
            assert.equal(actualHash, t.expectedName, `${actual} hash not match ${t.expectedName}`);
        }
    }));
    test('Name and hash (Linux)', () => __awaiter(this, void 0, void 0, function* () {
        for (const t of testDataLinux) {
            const platformService = TypeMoq.Mock.ofType();
            platformService.setup(x => x.isWindows).returns(() => false);
            platformService.setup(x => x.isMac).returns(() => false);
            platformService.setup(x => x.isLinux).returns(() => true);
            platformService.setup(x => x.is64bit).returns(() => true);
            const fs = TypeMoq.Mock.ofType();
            fs.setup(x => x.readFile(TypeMoq.It.isAnyString())).returns(() => Promise.resolve(`NAME="name"\nID=${t.name}\nID_LIKE=debian`));
            const pd = new platformData_1.PlatformData(platformService.object, fs.object);
            const actual = yield pd.getPlatformName();
            assert.equal(actual, t.expectedName, `${actual} does not match ${t.expectedName}`);
            const actualHash = yield pd.getExpectedHash();
            assert.equal(actual, t.expectedName, `${actual} hash not match ${t.expectedName}`);
        }
    }));
    test('Module name', () => __awaiter(this, void 0, void 0, function* () {
        for (const t of testDataModuleName) {
            const platformService = TypeMoq.Mock.ofType();
            platformService.setup(x => x.isWindows).returns(() => t.isWindows);
            platformService.setup(x => x.isLinux).returns(() => t.isLinux);
            platformService.setup(x => x.isMac).returns(() => t.isMac);
            const fs = TypeMoq.Mock.ofType();
            const pd = new platformData_1.PlatformData(platformService.object, fs.object);
            const actual = pd.getEngineExecutableName();
            assert.equal(actual, t.expectedName, `${actual} does not match ${t.expectedName}`);
        }
    }));
});
//# sourceMappingURL=platformData.unit.test.js.map