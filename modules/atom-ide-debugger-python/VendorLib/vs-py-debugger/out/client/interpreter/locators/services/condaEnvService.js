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
const inversify_1 = require("inversify");
const types_1 = require("../../../common/platform/types");
const types_2 = require("../../../common/types");
const types_3 = require("../../../ioc/types");
const contracts_1 = require("../../contracts");
const cacheableLocatorService_1 = require("./cacheableLocatorService");
const conda_1 = require("./conda");
/**
 * Locates conda env interpreters based on the conda service's info.
 */
let CondaEnvService = class CondaEnvService extends cacheableLocatorService_1.CacheableLocatorService {
    constructor(condaService, helper, logger, serviceContainer, fileSystem) {
        super('CondaEnvService', serviceContainer);
        this.condaService = condaService;
        this.helper = helper;
        this.logger = logger;
        this.fileSystem = fileSystem;
    }
    /**
     * Release any held resources.
     *
     * Called by VS Code to indicate it is done with the resource.
     */
    // tslint:disable-next-line:no-empty
    dispose() { }
    /**
     * Return the located interpreters.
     *
     * This is used by CacheableLocatorService.getInterpreters().
     */
    getInterpretersImplementation(resource) {
        return this.getSuggestionsFromConda();
    }
    /**
     * Return the list of interpreters for all the conda envs.
     */
    getSuggestionsFromConda() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const info = yield this.condaService.getCondaInfo();
                if (!info) {
                    return [];
                }
                const interpreters = yield parseCondaInfo(info, this.condaService, this.fileSystem, this.helper);
                const environments = yield this.condaService.getCondaEnvironments(true);
                if (Array.isArray(environments) && environments.length > 0) {
                    interpreters
                        .forEach(interpreter => {
                        const environment = environments.find(item => this.fileSystem.arePathsSame(item.path, interpreter.envPath));
                        if (environment) {
                            interpreter.envName = environment.name;
                        }
                    });
                }
                return interpreters;
            }
            catch (ex) {
                // Failed because either:
                //   1. conda is not installed.
                //   2. `conda info --json` has changed signature.
                //   3. output of `conda info --json` has changed in structure.
                // In all cases, we can't offer conda pythonPath suggestions.
                this.logger.logError('Failed to get Suggestions from conda', ex);
                return [];
            }
        });
    }
};
CondaEnvService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(contracts_1.ICondaService)),
    __param(1, inversify_1.inject(contracts_1.IInterpreterHelper)),
    __param(2, inversify_1.inject(types_2.ILogger)),
    __param(3, inversify_1.inject(types_3.IServiceContainer)),
    __param(4, inversify_1.inject(types_1.IFileSystem))
], CondaEnvService);
exports.CondaEnvService = CondaEnvService;
/**
 * Return the list of conda env interpreters.
 */
function parseCondaInfo(info, condaService, fileSystem, helper) {
    return __awaiter(this, void 0, void 0, function* () {
        // The root of the conda environment is itself a Python interpreter
        // envs reported as e.g.: /Users/bob/miniconda3/envs/someEnv.
        const envs = Array.isArray(info.envs) ? info.envs : [];
        if (info.default_prefix && info.default_prefix.length > 0) {
            envs.push(info.default_prefix);
        }
        const promises = envs
            .map((envPath) => __awaiter(this, void 0, void 0, function* () {
            const pythonPath = condaService.getInterpreterPath(envPath);
            if (!(yield fileSystem.fileExists(pythonPath))) {
                return;
            }
            const details = yield helper.getInterpreterInformation(pythonPath);
            if (!details) {
                return;
            }
            return Object.assign({}, details, { path: pythonPath, companyDisplayName: conda_1.AnacondaCompanyName, type: contracts_1.InterpreterType.Conda, envPath });
        }));
        return Promise.all(promises)
            .then(interpreters => interpreters.filter(interpreter => interpreter !== null && interpreter !== undefined))
            // tslint:disable-next-line:no-non-null-assertion
            .then(interpreters => interpreters.map(interpreter => interpreter));
    });
}
exports.parseCondaInfo = parseCondaInfo;
//# sourceMappingURL=condaEnvService.js.map