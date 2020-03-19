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
const path = require("path");
const types_1 = require("../../../common/platform/types");
const types_2 = require("../../../common/types");
const types_3 = require("../../../ioc/types");
const contracts_1 = require("../../contracts");
const cacheableLocatorService_1 = require("./cacheableLocatorService");
const conda_1 = require("./conda");
/**
 * Locate conda env interpreters based on the "conda environments file".
 */
let CondaEnvFileService = class CondaEnvFileService extends cacheableLocatorService_1.CacheableLocatorService {
    constructor(helperService, condaService, fileSystem, serviceContainer, logger) {
        super('CondaEnvFileService', serviceContainer);
        this.helperService = helperService;
        this.condaService = condaService;
        this.fileSystem = fileSystem;
        this.logger = logger;
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
     * Return the list of interpreters identified by the "conda environments file".
     */
    getSuggestionsFromConda() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.condaService.condaEnvironmentsFile) {
                return [];
            }
            return this.fileSystem.fileExists(this.condaService.condaEnvironmentsFile)
                .then(exists => exists ? this.getEnvironmentsFromFile(this.condaService.condaEnvironmentsFile) : Promise.resolve([]));
        });
    }
    /**
     * Return the list of environments identified in the given file.
     */
    getEnvironmentsFromFile(envFile) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const fileContents = yield this.fileSystem.readFile(envFile);
                const environmentPaths = fileContents.split(/\r?\n/g)
                    .map(environmentPath => environmentPath.trim())
                    .filter(environmentPath => environmentPath.length > 0);
                const interpreters = (yield Promise.all(environmentPaths
                    .map(environmentPath => this.getInterpreterDetails(environmentPath))))
                    .filter(item => !!item)
                    .map(item => item);
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
            catch (err) {
                this.logger.logError('Python Extension (getEnvironmentsFromFile.readFile):', err);
                // Ignore errors in reading the file.
                return [];
            }
        });
    }
    /**
     * Return the interpreter info for the given anaconda environment.
     */
    getInterpreterDetails(environmentPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const interpreter = this.condaService.getInterpreterPath(environmentPath);
            if (!interpreter || !(yield this.fileSystem.fileExists(interpreter))) {
                return;
            }
            const details = yield this.helperService.getInterpreterInformation(interpreter);
            if (!details) {
                return;
            }
            const envName = details.envName ? details.envName : path.basename(environmentPath);
            return Object.assign({}, details, { path: interpreter, companyDisplayName: conda_1.AnacondaCompanyName, type: contracts_1.InterpreterType.Conda, envPath: environmentPath, envName });
        });
    }
};
CondaEnvFileService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(contracts_1.IInterpreterHelper)),
    __param(1, inversify_1.inject(contracts_1.ICondaService)),
    __param(2, inversify_1.inject(types_1.IFileSystem)),
    __param(3, inversify_1.inject(types_3.IServiceContainer)),
    __param(4, inversify_1.inject(types_2.ILogger))
], CondaEnvFileService);
exports.CondaEnvFileService = CondaEnvFileService;
//# sourceMappingURL=condaEnvFileService.js.map