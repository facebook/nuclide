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
const semver_1 = require("semver");
const nugetService_1 = require("../../../client/common/nuget/nugetService");
suite('Nuget Service', () => {
    test('Identifying release versions', () => __awaiter(this, void 0, void 0, function* () {
        const service = new nugetService_1.NugetService();
        chai_1.expect(service.isReleaseVersion(semver_1.parse('0.1.1'))).to.be.equal(true, 'incorrect');
        chai_1.expect(service.isReleaseVersion(semver_1.parse('0.1.1-1'))).to.be.equal(false, 'incorrect');
        chai_1.expect(service.isReleaseVersion(semver_1.parse('0.1.1-release'))).to.be.equal(false, 'incorrect');
        chai_1.expect(service.isReleaseVersion(semver_1.parse('0.1.1-preview'))).to.be.equal(false, 'incorrect');
    }));
    test('Get package version', () => __awaiter(this, void 0, void 0, function* () {
        const service = new nugetService_1.NugetService();
        chai_1.expect(service.getVersionFromPackageFileName('Something-xyz.0.0.1.nupkg').compare(semver_1.parse('0.0.1'))).to.equal(0, 'incorrect');
        chai_1.expect(service.getVersionFromPackageFileName('Something-xyz.0.0.1.1234.nupkg').compare(semver_1.parse('0.0.1-1234'))).to.equal(0, 'incorrect');
        chai_1.expect(service.getVersionFromPackageFileName('Something-xyz.0.0.1-preview.nupkg').compare(semver_1.parse('0.0.1-preview'))).to.equal(0, 'incorrect');
    }));
});
//# sourceMappingURL=nugetService.unit.test.js.map