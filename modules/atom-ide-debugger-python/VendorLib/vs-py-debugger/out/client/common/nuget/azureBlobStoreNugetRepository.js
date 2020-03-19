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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("inversify");
const types_1 = require("../../ioc/types");
const telemetry_1 = require("../../telemetry");
const constants_1 = require("../../telemetry/constants");
const logger_1 = require("../logger");
const types_2 = require("./types");
let AzureBlobStoreNugetRepository = class AzureBlobStoreNugetRepository {
    constructor(serviceContainer, azureBlobStorageAccount, azureBlobStorageContainer, azureCDNBlobStorageAccount) {
        this.serviceContainer = serviceContainer;
        this.azureBlobStorageAccount = azureBlobStorageAccount;
        this.azureBlobStorageContainer = azureBlobStorageContainer;
        this.azureCDNBlobStorageAccount = azureCDNBlobStorageAccount;
    }
    getPackages(packageName) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.listPackages(this.azureBlobStorageAccount, this.azureBlobStorageContainer, packageName, this.azureCDNBlobStorageAccount);
        });
    }
    listPackages(azureBlobStorageAccount, azureBlobStorageContainer, packageName, azureCDNBlobStorageAccount) {
        // tslint:disable-next-line:no-require-imports
        const az = require('azure-storage');
        const blobStore = az.createBlobServiceAnonymous(azureBlobStorageAccount);
        const nugetService = this.serviceContainer.get(types_2.INugetService);
        return new Promise((resolve, reject) => {
            // We must pass undefined according to docs, but type definition doesn't all it to be undefined or null!!!
            // tslint:disable-next-line:no-any
            const token = undefined;
            blobStore.listBlobsSegmentedWithPrefix(azureBlobStorageContainer, packageName, token, (error, result) => {
                if (error) {
                    return reject(error);
                }
                resolve(result.entries.map(item => {
                    return {
                        package: item.name,
                        uri: `${azureCDNBlobStorageAccount}/${azureBlobStorageContainer}/${item.name}`,
                        version: nugetService.getVersionFromPackageFileName(item.name)
                    };
                }));
            });
        });
    }
};
__decorate([
    telemetry_1.captureTelemetry(constants_1.PYTHON_LANGUAGE_SERVER_LIST_BLOB_STORE_PACKAGES),
    logger_1.traceVerbose('Listing Nuget Packages')
], AzureBlobStoreNugetRepository.prototype, "listPackages", null);
AzureBlobStoreNugetRepository = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IServiceContainer)),
    __param(1, inversify_1.unmanaged()),
    __param(2, inversify_1.unmanaged()),
    __param(3, inversify_1.unmanaged())
], AzureBlobStoreNugetRepository);
exports.AzureBlobStoreNugetRepository = AzureBlobStoreNugetRepository;
//# sourceMappingURL=azureBlobStoreNugetRepository.js.map