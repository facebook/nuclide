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
const contracts_1 = require("../../interpreter/contracts");
const types_1 = require("../../ioc/types");
const types_2 = require("../types");
const moduleInstaller_1 = require("./moduleInstaller");
/**
 * A Python module installer for a conda environment.
 */
let CondaInstaller = class CondaInstaller extends moduleInstaller_1.ModuleInstaller {
    constructor(serviceContainer) {
        super(serviceContainer);
    }
    get displayName() {
        return 'Conda';
    }
    get priority() {
        return 0;
    }
    /**
     * Checks whether we can use Conda as module installer for a given resource.
     * We need to perform two checks:
     * 1. Ensure we have conda.
     * 2. Check if the current environment is a conda environment.
     * @param {Uri} [resource=] Resource used to identify the workspace.
     * @returns {Promise<boolean>} Whether conda is supported as a module installer or not.
     */
    isSupported(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isCondaAvailable === false) {
                return false;
            }
            const condaLocator = this.serviceContainer.get(contracts_1.ICondaService);
            this.isCondaAvailable = yield condaLocator.isCondaAvailable();
            if (!this.isCondaAvailable) {
                return false;
            }
            // Now we need to check if the current environment is a conda environment or not.
            return this.isCurrentEnvironmentACondaEnvironment(resource);
        });
    }
    /**
     * Return the commandline args needed to install the module.
     */
    getExecutionInfo(moduleName, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const condaService = this.serviceContainer.get(contracts_1.ICondaService);
            const condaFile = yield condaService.getCondaFile();
            const pythonPath = this.serviceContainer.get(types_2.IConfigurationService).getSettings(resource).pythonPath;
            const info = yield condaService.getCondaEnvironment(pythonPath);
            const args = ['install'];
            if (info && info.name) {
                // If we have the name of the conda environment, then use that.
                args.push('--name');
                args.push(info.name.toCommandArgument());
            }
            else if (info && info.path) {
                // Else provide the full path to the environment path.
                args.push('--prefix');
                args.push(info.path.fileToCommandArgument());
            }
            args.push(moduleName);
            return {
                args,
                execPath: condaFile
            };
        });
    }
    /**
     * Is anaconda the current interpreter?
     */
    isCurrentEnvironmentACondaEnvironment(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const condaService = this.serviceContainer.get(contracts_1.ICondaService);
            const pythonPath = this.serviceContainer.get(types_2.IConfigurationService).getSettings(resource).pythonPath;
            return condaService.isCondaEnvironment(pythonPath);
        });
    }
};
CondaInstaller = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IServiceContainer))
], CondaInstaller);
exports.CondaInstaller = CondaInstaller;
//# sourceMappingURL=condaInstaller.js.map