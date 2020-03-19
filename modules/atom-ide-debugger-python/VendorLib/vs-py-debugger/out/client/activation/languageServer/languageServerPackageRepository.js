// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("inversify");
const azureBlobStoreNugetRepository_1 = require("../../common/nuget/azureBlobStoreNugetRepository");
const types_1 = require("../../ioc/types");
const azureBlobStorageAccount = 'https://pvsc.blob.core.windows.net';
exports.azureCDNBlobStorageAccount = 'https://pvsc.azureedge.net';
var LanguageServerDownloadChannel;
(function (LanguageServerDownloadChannel) {
    LanguageServerDownloadChannel["stable"] = "stable";
    LanguageServerDownloadChannel["beta"] = "beta";
    LanguageServerDownloadChannel["daily"] = "daily";
})(LanguageServerDownloadChannel = exports.LanguageServerDownloadChannel || (exports.LanguageServerDownloadChannel = {}));
var LanguageServerPackageStorageContainers;
(function (LanguageServerPackageStorageContainers) {
    LanguageServerPackageStorageContainers["stable"] = "python-language-server-stable";
    LanguageServerPackageStorageContainers["beta"] = "python-language-server-beta";
    LanguageServerPackageStorageContainers["daily"] = "python-language-server-daily";
})(LanguageServerPackageStorageContainers = exports.LanguageServerPackageStorageContainers || (exports.LanguageServerPackageStorageContainers = {}));
let StableLanguageServerPackageRepository = class StableLanguageServerPackageRepository extends azureBlobStoreNugetRepository_1.AzureBlobStoreNugetRepository {
    constructor(serviceContainer) {
        super(serviceContainer, azureBlobStorageAccount, LanguageServerPackageStorageContainers.stable, exports.azureCDNBlobStorageAccount);
    }
};
StableLanguageServerPackageRepository = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IServiceContainer))
], StableLanguageServerPackageRepository);
exports.StableLanguageServerPackageRepository = StableLanguageServerPackageRepository;
let BetaLanguageServerPackageRepository = class BetaLanguageServerPackageRepository extends azureBlobStoreNugetRepository_1.AzureBlobStoreNugetRepository {
    constructor(serviceContainer) {
        super(serviceContainer, azureBlobStorageAccount, LanguageServerPackageStorageContainers.beta, exports.azureCDNBlobStorageAccount);
    }
};
BetaLanguageServerPackageRepository = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IServiceContainer))
], BetaLanguageServerPackageRepository);
exports.BetaLanguageServerPackageRepository = BetaLanguageServerPackageRepository;
let DailyLanguageServerPackageRepository = class DailyLanguageServerPackageRepository extends azureBlobStoreNugetRepository_1.AzureBlobStoreNugetRepository {
    constructor(serviceContainer) {
        super(serviceContainer, azureBlobStorageAccount, LanguageServerPackageStorageContainers.daily, exports.azureCDNBlobStorageAccount);
    }
};
DailyLanguageServerPackageRepository = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IServiceContainer))
], DailyLanguageServerPackageRepository);
exports.DailyLanguageServerPackageRepository = DailyLanguageServerPackageRepository;
//# sourceMappingURL=languageServerPackageRepository.js.map