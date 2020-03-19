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
const typeMoq = require("typemoq");
const types_1 = require("../../../client/activation/types");
const nugetRepository_1 = require("../../../client/common/nuget/nugetRepository");
suite('Nuget on Nuget Repo', () => {
    let serviceContainer;
    let httpClient;
    let nugetRepo;
    setup(() => {
        serviceContainer = typeMoq.Mock.ofType();
        httpClient = typeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(types_1.IHttpClient))).returns(() => httpClient.object);
        nugetRepo = new nugetRepository_1.NugetRepository(serviceContainer.object);
    });
    test('Get all package versions', () => __awaiter(this, void 0, void 0, function* () {
        const packageBaseAddress = 'a';
        const packageName = 'b';
        const resp = { versions: ['1.1.1', '1.2.1'] };
        const expectedUri = `${packageBaseAddress}/${packageName.toLowerCase().trim()}/index.json`;
        httpClient
            .setup(h => h.getJSON(typeMoq.It.isValue(expectedUri)))
            .returns(() => Promise.resolve(resp))
            .verifiable(typeMoq.Times.once());
        const versions = yield nugetRepo.getVersions(packageBaseAddress, packageName);
        httpClient.verifyAll();
        chai_1.expect(versions).to.be.lengthOf(2);
        chai_1.expect(versions.map(item => item.raw)).to.deep.equal(resp.versions);
    }));
    test('Get package uri', () => __awaiter(this, void 0, void 0, function* () {
        const packageBaseAddress = 'a';
        const packageName = 'b';
        const version = '1.1.3';
        const expectedUri = `${packageBaseAddress}/${packageName}/${version}/${packageName}.${version}.nupkg`;
        const packageUri = nugetRepo.getNugetPackageUri(packageBaseAddress, packageName, new semver_1.SemVer(version));
        httpClient.verifyAll();
        chai_1.expect(packageUri).to.equal(expectedUri);
    }));
    test('Get packages', () => __awaiter(this, void 0, void 0, function* () {
        const versions = ['1.1.1', '1.2.1', '2.2.2', '2.5.4', '2.9.5-release', '2.7.4-beta', '2.0.2', '3.5.4'];
        nugetRepo.getVersions = () => Promise.resolve(versions.map(v => new semver_1.SemVer(v)));
        nugetRepo.getNugetPackageUri = () => 'uri';
        const packages = yield nugetRepo.getPackages('packageName');
        chai_1.expect(packages).to.be.lengthOf(versions.length);
        chai_1.expect(packages.map(item => item.version.raw)).to.be.deep.equal(versions);
        chai_1.expect(packages.map(item => item.uri)).to.be.deep.equal(versions.map(() => 'uri'));
        chai_1.expect(packages.map(item => item.package)).to.be.deep.equal(versions.map(() => 'packageName'));
    }));
});
//# sourceMappingURL=nugetRepository.unit.test.js.map