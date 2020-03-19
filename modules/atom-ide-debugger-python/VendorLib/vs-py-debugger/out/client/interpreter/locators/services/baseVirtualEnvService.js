"use strict";
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
const _ = require("lodash");
const path = require("path");
const types_1 = require("../../../common/platform/types");
const contracts_1 = require("../../contracts");
const types_2 = require("../../virtualEnvs/types");
const helpers_1 = require("../helpers");
const cacheableLocatorService_1 = require("./cacheableLocatorService");
let BaseVirtualEnvService = class BaseVirtualEnvService extends cacheableLocatorService_1.CacheableLocatorService {
    constructor(searchPathsProvider, serviceContainer, name, cachePerWorkspace = false) {
        super(name, serviceContainer, cachePerWorkspace);
        this.searchPathsProvider = searchPathsProvider;
        this.virtualEnvMgr = serviceContainer.get(types_2.IVirtualEnvironmentManager);
        this.helper = serviceContainer.get(contracts_1.IInterpreterHelper);
        this.fileSystem = serviceContainer.get(types_1.IFileSystem);
    }
    // tslint:disable-next-line:no-empty
    dispose() { }
    getInterpretersImplementation(resource) {
        return this.suggestionsFromKnownVenvs(resource);
    }
    suggestionsFromKnownVenvs(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const searchPaths = yield this.searchPathsProvider.getSearchPaths(resource);
            return Promise.all(searchPaths.map(dir => this.lookForInterpretersInVenvs(dir, resource)))
                .then(listOfInterpreters => _.flatten(listOfInterpreters));
        });
    }
    lookForInterpretersInVenvs(pathToCheck, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.fileSystem.getSubDirectories(pathToCheck)
                .then(subDirs => Promise.all(this.getProspectiveDirectoriesForLookup(subDirs)))
                .then(dirs => dirs.filter(dir => dir.length > 0))
                .then(dirs => Promise.all(dirs.map(helpers_1.lookForInterpretersInDirectory)))
                .then(pathsWithInterpreters => _.flatten(pathsWithInterpreters))
                .then(interpreters => Promise.all(interpreters.map(interpreter => this.getVirtualEnvDetails(interpreter, resource))))
                .then(interpreters => interpreters.filter(interpreter => !!interpreter).map(interpreter => interpreter))
                .catch((err) => {
                console.error('Python Extension (lookForInterpretersInVenvs):', err);
                // Ignore exceptions.
                return [];
            });
        });
    }
    getProspectiveDirectoriesForLookup(subDirs) {
        const platform = this.serviceContainer.get(types_1.IPlatformService);
        const dirToLookFor = platform.virtualEnvBinName;
        return subDirs.map(subDir => this.fileSystem.getSubDirectories(subDir)
            .then(dirs => {
            const scriptOrBinDirs = dirs.filter(dir => {
                const folderName = path.basename(dir);
                return this.fileSystem.arePathsSame(folderName, dirToLookFor);
            });
            return scriptOrBinDirs.length === 1 ? scriptOrBinDirs[0] : '';
        })
            .catch((err) => {
            console.error('Python Extension (getProspectiveDirectoriesForLookup):', err);
            // Ignore exceptions.
            return '';
        }));
    }
    getVirtualEnvDetails(interpreter, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            return Promise.all([
                this.helper.getInterpreterInformation(interpreter),
                this.virtualEnvMgr.getEnvironmentName(interpreter, resource),
                this.virtualEnvMgr.getEnvironmentType(interpreter, resource)
            ])
                .then(([details, virtualEnvName, type]) => {
                if (!details) {
                    return;
                }
                return Object.assign({}, details, { envName: virtualEnvName, type: type });
            });
        });
    }
};
BaseVirtualEnvService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.unmanaged()),
    __param(1, inversify_1.unmanaged()),
    __param(2, inversify_1.unmanaged()),
    __param(3, inversify_1.unmanaged())
], BaseVirtualEnvService);
exports.BaseVirtualEnvService = BaseVirtualEnvService;
//# sourceMappingURL=baseVirtualEnvService.js.map