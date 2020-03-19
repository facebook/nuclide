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
const osinfo_1 = require("../../../client/common/platform/osinfo");
const platform = require("../../../client/common/utils/platform");
const version_1 = require("../../../client/common/utils/version");
exports.WIN_10 = new platform.Info(platform.OSType.Windows, 'x64', new semver.SemVer('10.0.1'));
exports.MAC_HIGH_SIERRA = new platform.Info(platform.OSType.OSX, 'x64', new semver.SemVer('10.13.1'));
exports.UBUNTU_BIONIC = new platform.Info(platform.OSType.Linux, 'x64', version_1.parseVersion('18.04'), 
//semver.coerce('18.04') || new semver.SemVer('0.0.0'),
platform.OSDistro.Ubuntu);
// tslint:disable-next-line:max-func-body-length
suite('OS Info - helpers', () => {
    test('getPathVariableName - Windows', () => __awaiter(this, void 0, void 0, function* () {
        const result = osinfo_1.getPathVariableName(exports.WIN_10);
        chai_1.expect(result).to.be.equal('Path', 'invalid value');
    }));
    test('getPathVariableName - Mac', () => __awaiter(this, void 0, void 0, function* () {
        const result = osinfo_1.getPathVariableName(exports.MAC_HIGH_SIERRA);
        chai_1.expect(result).to.be.equal('PATH', 'invalid value');
    }));
    test('getPathVariableName - Linux', () => __awaiter(this, void 0, void 0, function* () {
        const result = osinfo_1.getPathVariableName(exports.UBUNTU_BIONIC);
        chai_1.expect(result).to.be.equal('PATH', 'invalid value');
    }));
    test('getVirtualEnvBinName - Windows', () => __awaiter(this, void 0, void 0, function* () {
        const result = osinfo_1.getVirtualEnvBinName(exports.WIN_10);
        chai_1.expect(result).to.be.equal('scripts', 'invalid value');
    }));
    test('getVirtualEnvBinName - Mac', () => __awaiter(this, void 0, void 0, function* () {
        const result = osinfo_1.getVirtualEnvBinName(exports.MAC_HIGH_SIERRA);
        chai_1.expect(result).to.be.equal('bin', 'invalid value');
    }));
    test('getVirtualEnvBinName - Linux', () => __awaiter(this, void 0, void 0, function* () {
        const result = osinfo_1.getVirtualEnvBinName(exports.UBUNTU_BIONIC);
        chai_1.expect(result).to.be.equal('bin', 'invalid value');
    }));
});
//# sourceMappingURL=osinfo.unit.test.js.map