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
const types_1 = require("../../../common/platform/types");
const types_2 = require("../../../common/process/types");
const types_3 = require("../../../common/types");
const types_4 = require("../../../ioc/types");
const contracts_1 = require("../../contracts");
const cacheableLocatorService_1 = require("./cacheableLocatorService");
/**
 * Locates the currently configured Python interpreter.
 *
 * If no interpreter is configured then it falls back to the system
 * Python (3 then 2).
 */
let CurrentPathService = class CurrentPathService extends cacheableLocatorService_1.CacheableLocatorService {
    constructor(helper, processServiceFactory, serviceContainer) {
        super('CurrentPathService', serviceContainer);
        this.helper = helper;
        this.processServiceFactory = processServiceFactory;
        this.fs = serviceContainer.get(types_1.IFileSystem);
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
        return this.suggestionsFromKnownPaths(resource);
    }
    /**
     * Return the located interpreters.
     */
    suggestionsFromKnownPaths(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const configSettings = this.serviceContainer.get(types_3.IConfigurationService).getSettings(resource);
            const currentPythonInterpreter = this.getInterpreter(configSettings.pythonPath, '').then(interpreter => [interpreter]);
            const python3 = this.getInterpreter('python3', '').then(interpreter => [interpreter]);
            const python2 = this.getInterpreter('python2', '').then(interpreter => [interpreter]);
            const python = this.getInterpreter('python', '').then(interpreter => [interpreter]);
            return Promise.all([currentPythonInterpreter, python3, python2, python])
                // tslint:disable-next-line:underscore-consistent-invocation
                .then(listOfInterpreters => _.flatten(listOfInterpreters))
                .then(interpreters => interpreters.filter(item => item.length > 0))
                // tslint:disable-next-line:promise-function-async
                .then(interpreters => Promise.all(interpreters.map(interpreter => this.getInterpreterDetails(interpreter))))
                .then(interpreters => interpreters.filter(item => !!item).map(item => item));
        });
    }
    /**
     * Return the information about the identified interpreter binary.
     */
    getInterpreterDetails(interpreter) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.helper.getInterpreterInformation(interpreter)
                .then(details => {
                if (!details) {
                    return;
                }
                return Object.assign({}, details, { path: interpreter, type: details.type ? details.type : contracts_1.InterpreterType.Unknown });
            });
        });
    }
    /**
     * Return the path to the interpreter (or the default if not found).
     */
    getInterpreter(pythonPath, defaultValue) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const processService = yield this.processServiceFactory.create();
                return processService.exec(pythonPath, ['-c', 'import sys;print(sys.executable)'], {})
                    .then(output => output.stdout.trim())
                    .then((value) => __awaiter(this, void 0, void 0, function* () {
                    if (value.length > 0 && (yield this.fs.fileExists(value))) {
                        return value;
                    }
                    return defaultValue;
                }))
                    .catch(() => defaultValue); // Ignore exceptions in getting the executable.
            }
            catch (_a) {
                return defaultValue; // Ignore exceptions in getting the executable.
            }
        });
    }
};
CurrentPathService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(contracts_1.IInterpreterHelper)),
    __param(1, inversify_1.inject(types_2.IProcessServiceFactory)),
    __param(2, inversify_1.inject(types_4.IServiceContainer))
], CurrentPathService);
exports.CurrentPathService = CurrentPathService;
//# sourceMappingURL=currentPathService.js.map