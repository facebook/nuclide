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
// tslint:disable:no-any no-invalid-this max-func-body-length
const chai_1 = require("chai");
const semver_1 = require("semver");
const typeMoq = require("typemoq");
const languageServerPackageRepository_1 = require("../../../client/activation/languageServer/languageServerPackageRepository");
const languageServerPackageService_1 = require("../../../client/activation/languageServer/languageServerPackageService");
const platformData_1 = require("../../../client/activation/platformData");
const nugetService_1 = require("../../../client/common/nuget/nugetService");
const types_1 = require("../../../client/common/nuget/types");
const types_2 = require("../../../client/common/platform/types");
const platform_1 = require("../../../client/common/utils/platform");
const downloadBaseFileName = 'Python-Language-Server';
suite('Language Server Package Service', () => {
    let serviceContainer;
    let platform;
    let lsPackageService;
    let appVersion;
    setup(() => {
        serviceContainer = typeMoq.Mock.ofType();
        platform = typeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(types_2.IPlatformService))).returns(() => platform.object);
        appVersion = typeMoq.Mock.ofType();
        lsPackageService = new languageServerPackageService_1.LanguageServerPackageService(serviceContainer.object, appVersion.object);
        lsPackageService.getLanguageServerDownloadChannel = () => 'stable';
    });
    function setMinVersionOfLs(version) {
        const packageJson = { languageServerVersion: version };
        appVersion.setup(e => e.packageJson).returns(() => packageJson);
    }
    [true, false].forEach(is64Bit => {
        const bitness = is64Bit ? '64bit' : '32bit';
        const architecture = is64Bit ? platform_1.Architecture.x64 : platform_1.Architecture.x86;
        test(`Get Package name for Windows (${bitness})`, () => __awaiter(this, void 0, void 0, function* () {
            platform
                .setup(p => p.info)
                .returns(() => { return { type: platform_1.OSType.Windows, architecture }; })
                .verifiable(typeMoq.Times.atLeastOnce());
            const expectedName = is64Bit ? `${downloadBaseFileName}-${platformData_1.PlatformName.Windows64Bit}` : `${downloadBaseFileName}-${platformData_1.PlatformName.Windows32Bit}`;
            const name = lsPackageService.getNugetPackageName();
            platform.verifyAll();
            chai_1.expect(name).to.be.equal(expectedName);
        }));
        test(`Get Package name for Mac (${bitness})`, () => __awaiter(this, void 0, void 0, function* () {
            platform
                .setup(p => p.info)
                .returns(() => { return { type: platform_1.OSType.OSX, architecture }; })
                .verifiable(typeMoq.Times.atLeastOnce());
            const expectedName = `${downloadBaseFileName}-${platformData_1.PlatformName.Mac64Bit}`;
            const name = lsPackageService.getNugetPackageName();
            platform.verifyAll();
            chai_1.expect(name).to.be.equal(expectedName);
        }));
        test(`Get Package name for Linux (${bitness})`, () => __awaiter(this, void 0, void 0, function* () {
            platform
                .setup(p => p.info)
                .returns(() => { return { type: platform_1.OSType.Linux, architecture }; })
                .verifiable(typeMoq.Times.atLeastOnce());
            const expectedName = `${downloadBaseFileName}-${platformData_1.PlatformName.Linux64Bit}`;
            const name = lsPackageService.getNugetPackageName();
            platform.verifyAll();
            chai_1.expect(name).to.be.equal(expectedName);
        }));
    });
    test('Get latest nuget package version', () => __awaiter(this, void 0, void 0, function* () {
        const packageName = 'packageName';
        lsPackageService.getNugetPackageName = () => packageName;
        lsPackageService.maxMajorVersion = 3;
        setMinVersionOfLs('0.0.1');
        const packages = [
            { package: '', uri: '', version: new semver_1.SemVer('1.1.1') },
            { package: '', uri: '', version: new semver_1.SemVer('3.4.1') },
            { package: '', uri: '', version: new semver_1.SemVer('3.1.1') },
            { package: '', uri: '', version: new semver_1.SemVer('2.1.1') }
        ];
        const expectedPackage = packages[1];
        const repo = typeMoq.Mock.ofType();
        const nuget = typeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(types_1.INugetRepository), typeMoq.It.isAny())).returns(() => repo.object);
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(types_1.INugetService))).returns(() => nuget.object);
        repo
            .setup(n => n.getPackages(typeMoq.It.isValue(packageName)))
            .returns(() => Promise.resolve(packages))
            .verifiable(typeMoq.Times.once());
        nuget
            .setup(n => n.isReleaseVersion(typeMoq.It.isAny()))
            .returns(() => true)
            .verifiable(typeMoq.Times.atLeastOnce());
        const info = yield lsPackageService.getLatestNugetPackageVersion();
        repo.verifyAll();
        nuget.verifyAll();
        chai_1.expect(info).to.deep.equal(expectedPackage);
    }));
    test('Get latest nuget package version (excluding non-release)', () => __awaiter(this, void 0, void 0, function* () {
        setMinVersionOfLs('0.0.1');
        const packageName = 'packageName';
        lsPackageService.getNugetPackageName = () => packageName;
        lsPackageService.maxMajorVersion = 1;
        const packages = [
            { package: '', uri: '', version: new semver_1.SemVer('1.1.1') },
            { package: '', uri: '', version: new semver_1.SemVer('1.3.1-alpha') },
            { package: '', uri: '', version: new semver_1.SemVer('1.4.1-preview') },
            { package: '', uri: '', version: new semver_1.SemVer('1.2.1-internal') }
        ];
        const expectedPackage = packages[0];
        const repo = typeMoq.Mock.ofType();
        const nuget = new nugetService_1.NugetService();
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(types_1.INugetRepository), typeMoq.It.isAny())).returns(() => repo.object);
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(types_1.INugetService))).returns(() => nuget);
        repo
            .setup(n => n.getPackages(typeMoq.It.isValue(packageName)))
            .returns(() => Promise.resolve(packages))
            .verifiable(typeMoq.Times.once());
        const info = yield lsPackageService.getLatestNugetPackageVersion();
        repo.verifyAll();
        chai_1.expect(info).to.deep.equal(expectedPackage);
    }));
    test('Ensure minimum version of package is used', () => __awaiter(this, void 0, void 0, function* () {
        const minimumVersion = '0.1.50';
        setMinVersionOfLs(minimumVersion);
        const packageName = 'packageName';
        lsPackageService.getNugetPackageName = () => packageName;
        lsPackageService.maxMajorVersion = 0;
        const packages = [
            { package: '', uri: '', version: new semver_1.SemVer('0.1.48') },
            { package: '', uri: '', version: new semver_1.SemVer('0.1.49') }
        ];
        const repo = typeMoq.Mock.ofType();
        const nuget = new nugetService_1.NugetService();
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(types_1.INugetRepository), typeMoq.It.isAny())).returns(() => repo.object);
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(types_1.INugetService))).returns(() => nuget);
        repo
            .setup(n => n.getPackages(typeMoq.It.isValue(packageName)))
            .returns(() => Promise.resolve(packages))
            .verifiable(typeMoq.Times.once());
        const info = yield lsPackageService.getLatestNugetPackageVersion();
        repo.verifyAll();
        const expectedPackage = {
            version: new semver_1.SemVer(minimumVersion),
            package: languageServerPackageRepository_1.LanguageServerPackageStorageContainers.stable,
            uri: `${languageServerPackageRepository_1.azureCDNBlobStorageAccount}/${languageServerPackageRepository_1.LanguageServerPackageStorageContainers.stable}/${packageName}.${minimumVersion}.nupkg`
        };
        chai_1.expect(info).to.deep.equal(expectedPackage);
    }));
});
//# sourceMappingURL=languageServerPackageService.unit.test.js.map