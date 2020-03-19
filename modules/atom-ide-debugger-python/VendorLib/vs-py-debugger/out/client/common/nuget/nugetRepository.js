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
const semver_1 = require("semver");
const types_1 = require("../../activation/types");
const types_2 = require("../../ioc/types");
const nugetPackageBaseAddress = 'https://dotnetmyget.blob.core.windows.net/artifacts/dotnet-core-svc/nuget/v3/flatcontainer';
let NugetRepository = class NugetRepository {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
    }
    getPackages(packageName) {
        return __awaiter(this, void 0, void 0, function* () {
            const versions = yield this.getVersions(nugetPackageBaseAddress, packageName);
            return versions.map(version => {
                const uri = this.getNugetPackageUri(nugetPackageBaseAddress, packageName, version);
                return { version, uri, package: packageName };
            });
        });
    }
    getVersions(packageBaseAddress, packageName) {
        return __awaiter(this, void 0, void 0, function* () {
            const uri = `${packageBaseAddress}/${packageName.toLowerCase().trim()}/index.json`;
            const httpClient = this.serviceContainer.get(types_1.IHttpClient);
            const result = yield httpClient.getJSON(uri);
            return result.versions.map(v => semver_1.parse(v, true) || new semver_1.SemVer('0.0.0'));
        });
    }
    getNugetPackageUri(packageBaseAddress, packageName, version) {
        return `${packageBaseAddress}/${packageName}/${version.raw}/${packageName}.${version.raw}.nupkg`;
    }
};
NugetRepository = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_2.IServiceContainer))
], NugetRepository);
exports.NugetRepository = NugetRepository;
//# sourceMappingURL=nugetRepository.js.map