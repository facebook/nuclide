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
const os = require("os");
const platformService_1 = require("../../../client/common/platform/platformService");
const platform_1 = require("../../../client/common/utils/platform");
// tslint:disable-next-line:max-func-body-length
suite('PlatformService', () => {
    test('local info', () => __awaiter(this, void 0, void 0, function* () {
        const expected = platform_1.getInfo();
        const svc = new platformService_1.PlatformService();
        const info = svc.info;
        chai_1.expect(info).to.deep.equal(expected, 'invalid value');
    }));
    test('pathVariableName', () => __awaiter(this, void 0, void 0, function* () {
        let expected = 'PATH';
        if (/^win/.test(process.platform)) {
            expected = 'Path';
        }
        const svc = new platformService_1.PlatformService();
        const result = svc.pathVariableName;
        chai_1.expect(result).to.be.equal(expected, 'invalid value');
    }));
    test('virtualEnvBinName - Windows', () => __awaiter(this, void 0, void 0, function* () {
        let expected = 'bin';
        if (/^win/.test(process.platform)) {
            expected = 'scripts';
        }
        const svc = new platformService_1.PlatformService();
        const result = svc.virtualEnvBinName;
        chai_1.expect(result).to.be.equal(expected, 'invalid value');
    }));
    test('isWindows', () => __awaiter(this, void 0, void 0, function* () {
        let expected = false;
        if (/^win/.test(process.platform)) {
            expected = true;
        }
        const svc = new platformService_1.PlatformService();
        const result = svc.isWindows;
        chai_1.expect(result).to.be.equal(expected, 'invalid value');
    }));
    test('isMac', () => __awaiter(this, void 0, void 0, function* () {
        let expected = false;
        if (/^darwin/.test(process.platform)) {
            expected = true;
        }
        const svc = new platformService_1.PlatformService();
        const result = svc.isMac;
        chai_1.expect(result).to.be.equal(expected, 'invalid value');
    }));
    test('isLinux', () => __awaiter(this, void 0, void 0, function* () {
        let expected = false;
        if (/^linux/.test(process.platform)) {
            expected = true;
        }
        const svc = new platformService_1.PlatformService();
        const result = svc.isLinux;
        chai_1.expect(result).to.be.equal(expected, 'invalid value');
    }));
    test('is64bit', () => __awaiter(this, void 0, void 0, function* () {
        let expected = true;
        if (os.arch() !== 'x64') {
            expected = false;
        }
        const svc = new platformService_1.PlatformService();
        const result = svc.is64bit;
        chai_1.expect(result).to.be.equal(expected, 'invalid value');
    }));
});
//# sourceMappingURL=platformService.unit.test.js.map