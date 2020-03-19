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
const typeMoq = require("typemoq");
const languageServerPackageRepository_1 = require("../../../client/activation/languageServer/languageServerPackageRepository");
const languageServerPackageService_1 = require("../../../client/activation/languageServer/languageServerPackageService");
const types_1 = require("../../../client/activation/types");
const types_2 = require("../../../client/common/application/types");
const httpClient_1 = require("../../../client/common/net/httpClient");
const azureBlobStoreNugetRepository_1 = require("../../../client/common/nuget/azureBlobStoreNugetRepository");
const nugetRepository_1 = require("../../../client/common/nuget/nugetRepository");
const nugetService_1 = require("../../../client/common/nuget/nugetService");
const types_3 = require("../../../client/common/nuget/types");
const platformService_1 = require("../../../client/common/platform/platformService");
const types_4 = require("../../../client/common/platform/types");
const azureBlobStorageAccount = 'https://pvsc.blob.core.windows.net';
const azureCDNBlobStorageAccount = 'https://pvsc.azureedge.net';
suite('Language Server Package Service', () => {
    let serviceContainer;
    setup(() => {
        serviceContainer = typeMoq.Mock.ofType();
    });
    test('Ensure new Major versions of Language Server is accounted for (nuget)', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const skipped = true;
            if (skipped) {
                // tslint:disable-next-line:no-suspicious-comment
                // TODO: Why was this skipped?  See gh-2615.
                return this.skip();
            }
            const workSpaceService = typeMoq.Mock.ofType();
            const config = typeMoq.Mock.ofType();
            config
                .setup(c => c.get(typeMoq.It.isValue('proxy'), typeMoq.It.isValue('')))
                .returns(() => '')
                .verifiable(typeMoq.Times.once());
            workSpaceService
                .setup(w => w.getConfiguration(typeMoq.It.isValue('http')))
                .returns(() => config.object)
                .verifiable(typeMoq.Times.once());
            serviceContainer.setup(a => a.get(typeMoq.It.isValue(types_2.IWorkspaceService))).returns(() => workSpaceService.object);
            const nugetService = new nugetService_1.NugetService();
            serviceContainer.setup(c => c.get(typeMoq.It.isValue(types_3.INugetService))).returns(() => nugetService);
            const httpClient = new httpClient_1.HttpClient(serviceContainer.object);
            serviceContainer.setup(c => c.get(typeMoq.It.isValue(types_1.IHttpClient))).returns(() => httpClient);
            const platformService = new platformService_1.PlatformService();
            serviceContainer.setup(c => c.get(typeMoq.It.isValue(types_4.IPlatformService))).returns(() => platformService);
            const nugetRepo = new nugetRepository_1.NugetRepository(serviceContainer.object);
            serviceContainer.setup(c => c.get(typeMoq.It.isValue(types_3.INugetRepository))).returns(() => nugetRepo);
            const appEnv = typeMoq.Mock.ofType();
            const packageJson = { languageServerVersion: '0.1.0' };
            appEnv.setup(e => e.packageJson).returns(() => packageJson);
            const lsPackageService = new languageServerPackageService_1.LanguageServerPackageService(serviceContainer.object, appEnv.object);
            const packageName = lsPackageService.getNugetPackageName();
            const packages = yield nugetRepo.getPackages(packageName);
            const latestReleases = packages
                .filter(item => nugetService.isReleaseVersion(item.version))
                .sort((a, b) => a.version.compare(b.version));
            const latestRelease = latestReleases[latestReleases.length - 1];
            config.verifyAll();
            workSpaceService.verifyAll();
            chai_1.expect(packages).to.be.length.greaterThan(0, 'No packages returned.');
            chai_1.expect(latestReleases).to.be.length.greaterThan(0, 'No release packages returned.');
            chai_1.expect(latestRelease.version.major).to.be.equal(lsPackageService.maxMajorVersion, 'New Major version of Language server has been released, we need to update it at our end.');
        });
    });
    test('Ensure new Major versions of Language Server is accounted for (azure blob)', () => __awaiter(this, void 0, void 0, function* () {
        const nugetService = new nugetService_1.NugetService();
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(types_3.INugetService))).returns(() => nugetService);
        const platformService = new platformService_1.PlatformService();
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(types_4.IPlatformService))).returns(() => platformService);
        const defaultStorageChannel = languageServerPackageRepository_1.LanguageServerPackageStorageContainers.stable;
        const nugetRepo = new azureBlobStoreNugetRepository_1.AzureBlobStoreNugetRepository(serviceContainer.object, azureBlobStorageAccount, defaultStorageChannel, azureCDNBlobStorageAccount);
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(types_3.INugetRepository))).returns(() => nugetRepo);
        const appEnv = typeMoq.Mock.ofType();
        const packageJson = { languageServerVersion: '0.1.0' };
        appEnv.setup(e => e.packageJson).returns(() => packageJson);
        const lsPackageService = new languageServerPackageService_1.LanguageServerPackageService(serviceContainer.object, appEnv.object);
        const packageName = lsPackageService.getNugetPackageName();
        const packages = yield nugetRepo.getPackages(packageName);
        const latestReleases = packages
            .filter(item => nugetService.isReleaseVersion(item.version))
            .sort((a, b) => a.version.compare(b.version));
        const latestRelease = latestReleases[latestReleases.length - 1];
        chai_1.expect(packages).to.be.length.greaterThan(0, 'No packages returned.');
        chai_1.expect(latestReleases).to.be.length.greaterThan(0, 'No release packages returned.');
        chai_1.expect(latestRelease.version.major).to.be.equal(lsPackageService.maxMajorVersion, 'New Major version of Language server has been released, we need to update it at our end.');
    }));
});
//# sourceMappingURL=languageServerPackageService.test.js.map