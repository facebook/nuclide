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
const languageServerPackageRepository_1 = require("../../../client/activation/languageServer/languageServerPackageRepository");
const languageServerPackageService_1 = require("../../../client/activation/languageServer/languageServerPackageService");
const types_1 = require("../../../client/activation/types");
const azureBlobStoreNugetRepository_1 = require("../../../client/common/nuget/azureBlobStoreNugetRepository");
const types_2 = require("../../../client/common/nuget/types");
const platformService_1 = require("../../../client/common/platform/platformService");
const types_3 = require("../../../client/common/platform/types");
const azureBlobStorageAccount = 'https://pvsc.blob.core.windows.net';
const azureCDNBlobStorageAccount = 'https://pvsc.azureedge.net';
suite('Nuget Azure Storage Repository', () => {
    let serviceContainer;
    let httpClient;
    let repo;
    setup(() => {
        serviceContainer = typeMoq.Mock.ofType();
        httpClient = typeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(types_1.IHttpClient))).returns(() => httpClient.object);
        const nugetService = typeMoq.Mock.ofType();
        nugetService.setup(n => n.getVersionFromPackageFileName(typeMoq.It.isAny())).returns(() => new semver_1.SemVer('1.1.1'));
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(types_2.INugetService))).returns(() => nugetService.object);
        const defaultStorageChannel = languageServerPackageRepository_1.LanguageServerPackageStorageContainers.stable;
        repo = new azureBlobStoreNugetRepository_1.AzureBlobStoreNugetRepository(serviceContainer.object, azureBlobStorageAccount, defaultStorageChannel, azureCDNBlobStorageAccount);
    });
    test('Get all packages', function () {
        return __awaiter(this, void 0, void 0, function* () {
            // tslint:disable-next-line:no-invalid-this
            this.timeout(15000);
            const platformService = new platformService_1.PlatformService();
            serviceContainer.setup(c => c.get(typeMoq.It.isValue(types_3.IPlatformService))).returns(() => platformService);
            const packageJson = { languageServerVersion: '0.1.0' };
            const appEnv = typeMoq.Mock.ofType();
            appEnv.setup(e => e.packageJson).returns(() => packageJson);
            const lsPackageService = new languageServerPackageService_1.LanguageServerPackageService(serviceContainer.object, appEnv.object);
            const packageName = lsPackageService.getNugetPackageName();
            const packages = yield repo.getPackages(packageName);
            chai_1.expect(packages).to.be.length.greaterThan(0);
        });
    });
});
//# sourceMappingURL=azureBobStoreRepository.test.js.map