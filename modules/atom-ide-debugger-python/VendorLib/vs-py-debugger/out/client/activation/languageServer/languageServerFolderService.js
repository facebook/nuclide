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
const path = require("path");
const semver = require("semver");
const constants_1 = require("../../common/constants");
const logger_1 = require("../../common/logger");
const types_1 = require("../../common/platform/types");
const types_2 = require("../../common/types");
const types_3 = require("../../ioc/types");
const types_4 = require("../types");
const languageServerFolder = 'languageServer';
let LanguageServerFolderService = class LanguageServerFolderService {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
    }
    getLanguageServerFolderName() {
        return __awaiter(this, void 0, void 0, function* () {
            const currentFolder = yield this.getCurrentLanguageServerDirectory();
            let serverVersion;
            const shouldLookForNewVersion = yield this.shouldLookForNewLanguageServer(currentFolder);
            if (currentFolder && !shouldLookForNewVersion) {
                return path.basename(currentFolder.path);
            }
            serverVersion = yield this.getLatestLanguageServerVersion()
                .catch(ex => undefined);
            if (currentFolder && (!serverVersion || serverVersion.version.compare(currentFolder.version) <= 0)) {
                return path.basename(currentFolder.path);
            }
            return `${languageServerFolder}.${serverVersion.version.raw}`;
        });
    }
    getLatestLanguageServerVersion() {
        const lsPackageService = this.serviceContainer.get(types_4.ILanguageServerPackageService);
        return lsPackageService.getLatestNugetPackageVersion();
    }
    shouldLookForNewLanguageServer(currentFolder) {
        return __awaiter(this, void 0, void 0, function* () {
            const configService = this.serviceContainer.get(types_2.IConfigurationService);
            const autoUpdateLanguageServer = configService.getSettings().autoUpdateLanguageServer;
            const downloadLanguageServer = configService.getSettings().downloadLanguageServer;
            if (currentFolder && (!autoUpdateLanguageServer || !downloadLanguageServer)) {
                return false;
            }
            const downloadChannel = this.getDownloadChannel();
            const rule = this.serviceContainer.get(types_4.IDownloadChannelRule, downloadChannel);
            return rule.shouldLookForNewLanguageServer(currentFolder);
        });
    }
    getCurrentLanguageServerDirectory() {
        return __awaiter(this, void 0, void 0, function* () {
            const configService = this.serviceContainer.get(types_2.IConfigurationService);
            if (!configService.getSettings().downloadLanguageServer) {
                return { path: languageServerFolder, version: new semver.SemVer('0.0.0') };
            }
            const dirs = yield this.getExistingLanguageServerDirectories();
            if (dirs.length === 0) {
                return;
            }
            dirs.sort((a, b) => a.version.compare(b.version));
            return dirs[dirs.length - 1];
        });
    }
    getExistingLanguageServerDirectories() {
        return __awaiter(this, void 0, void 0, function* () {
            const fs = this.serviceContainer.get(types_1.IFileSystem);
            const subDirs = yield fs.getSubDirectories(constants_1.EXTENSION_ROOT_DIR);
            return subDirs
                .filter(dir => path.basename(dir).startsWith(languageServerFolder))
                .map(dir => { return { path: dir, version: this.getFolderVersion(path.basename(dir)) }; });
        });
    }
    getFolderVersion(dirName) {
        const suffix = dirName.substring(languageServerFolder.length + 1);
        return suffix.length === 0 ? new semver.SemVer('0.0.0') : (semver.parse(suffix, true) || new semver.SemVer('0.0.0'));
    }
    getDownloadChannel() {
        const lsPackageService = this.serviceContainer.get(types_4.ILanguageServerPackageService);
        return lsPackageService.getLanguageServerDownloadChannel();
    }
};
__decorate([
    logger_1.traceVerbose('Get language server folder name')
], LanguageServerFolderService.prototype, "getLanguageServerFolderName", null);
__decorate([
    logger_1.traceVerbose('Get latest version of Language Server')
], LanguageServerFolderService.prototype, "getLatestLanguageServerVersion", null);
LanguageServerFolderService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_3.IServiceContainer))
], LanguageServerFolderService);
exports.LanguageServerFolderService = LanguageServerFolderService;
//# sourceMappingURL=languageServerFolderService.js.map