"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
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
// tslint:disable:no-any
const inversify_1 = require("inversify");
const md5 = require("md5");
const vscode_1 = require("vscode");
const types_1 = require("../../../common/application/types");
require("../../../common/extensions");
const logger_1 = require("../../../common/logger");
const types_2 = require("../../../common/types");
const async_1 = require("../../../common/utils/async");
let CacheableLocatorService = class CacheableLocatorService {
    constructor(name, serviceContainer, cachePerWorkspace = false) {
        this.serviceContainer = serviceContainer;
        this.cachePerWorkspace = cachePerWorkspace;
        this.promisesPerResource = new Map();
        this.handlersAddedToResource = new Set();
        this.locating = new vscode_1.EventEmitter();
        this.cacheKeyPrefix = `INTERPRETERS_CACHE_v2_${name}`;
    }
    get onLocating() {
        return this.locating.event;
    }
    getInterpreters(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = this.getCacheKey(resource);
            let deferred = this.promisesPerResource.get(cacheKey);
            if (!deferred) {
                deferred = async_1.createDeferred();
                this.promisesPerResource.set(cacheKey, deferred);
                this.addHandlersForInterpreterWatchers(cacheKey, resource)
                    .ignoreErrors();
                this.getInterpretersImplementation(resource)
                    .then((items) => __awaiter(this, void 0, void 0, function* () {
                    yield this.cacheInterpreters(items, resource);
                    deferred.resolve(items);
                }))
                    .catch(ex => deferred.reject(ex));
                this.locating.fire(deferred.promise);
            }
            if (deferred.completed) {
                return deferred.promise;
            }
            const cachedInterpreters = this.getCachedInterpreters(resource);
            return Array.isArray(cachedInterpreters) ? cachedInterpreters : deferred.promise;
        });
    }
    addHandlersForInterpreterWatchers(cacheKey, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.handlersAddedToResource.has(cacheKey)) {
                return;
            }
            this.handlersAddedToResource.add(cacheKey);
            const watchers = yield this.getInterpreterWatchers(resource);
            const disposableRegisry = this.serviceContainer.get(types_2.IDisposableRegistry);
            watchers.forEach(watcher => {
                watcher.onDidCreate(() => {
                    logger_1.Logger.verbose(`Interpreter Watcher change handler for ${this.cacheKeyPrefix}`);
                    this.promisesPerResource.delete(cacheKey);
                    this.getInterpreters(resource).ignoreErrors();
                }, this, disposableRegisry);
            });
        });
    }
    getInterpreterWatchers(_resource) {
        return __awaiter(this, void 0, void 0, function* () {
            return [];
        });
    }
    createPersistenceStore(resource) {
        const cacheKey = this.getCacheKey(resource);
        const persistentFactory = this.serviceContainer.get(types_2.IPersistentStateFactory);
        if (this.cachePerWorkspace) {
            return persistentFactory.createWorkspacePersistentState(cacheKey, undefined);
        }
        else {
            return persistentFactory.createGlobalPersistentState(cacheKey, undefined);
        }
    }
    getCachedInterpreters(resource) {
        const persistence = this.createPersistenceStore(resource);
        if (!Array.isArray(persistence.value)) {
            return;
        }
        return persistence.value.map(item => {
            return Object.assign({}, item, { cachedEntry: true });
        });
    }
    cacheInterpreters(interpreters, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const persistence = this.createPersistenceStore(resource);
            yield persistence.updateValue(interpreters);
        });
    }
    getCacheKey(resource) {
        if (!resource || !this.cachePerWorkspace) {
            return this.cacheKeyPrefix;
        }
        // Ensure we have separate caches per workspace where necessary.Î
        const workspaceService = this.serviceContainer.get(types_1.IWorkspaceService);
        if (!Array.isArray(workspaceService.workspaceFolders)) {
            return this.cacheKeyPrefix;
        }
        const workspace = workspaceService.getWorkspaceFolder(resource);
        return workspace ? `${this.cacheKeyPrefix}:${md5(workspace.uri.fsPath)}` : this.cacheKeyPrefix;
    }
};
CacheableLocatorService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.unmanaged()),
    __param(1, inversify_1.unmanaged()),
    __param(2, inversify_1.unmanaged())
], CacheableLocatorService);
exports.CacheableLocatorService = CacheableLocatorService;
//# sourceMappingURL=cacheableLocatorService.js.map