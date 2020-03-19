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
const types_2 = require("../../../common/types");
const fs_1 = require("../../../common/utils/fs");
const types_3 = require("../../../ioc/types");
const contracts_1 = require("../../contracts");
const helpers_1 = require("../helpers");
const cacheableLocatorService_1 = require("./cacheableLocatorService");
/**
 * Locates "known" paths.
 */
let KnownPathsService = class KnownPathsService extends cacheableLocatorService_1.CacheableLocatorService {
    constructor(knownSearchPaths, helper, serviceContainer) {
        super('KnownPathsService', serviceContainer);
        this.knownSearchPaths = knownSearchPaths;
        this.helper = helper;
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
        return this.suggestionsFromKnownPaths();
    }
    /**
     * Return the located interpreters.
     */
    suggestionsFromKnownPaths() {
        const promises = this.knownSearchPaths.getSearchPaths().map(dir => this.getInterpretersInDirectory(dir));
        return Promise.all(promises)
            // tslint:disable-next-line:underscore-consistent-invocation
            .then(listOfInterpreters => _.flatten(listOfInterpreters))
            .then(interpreters => interpreters.filter(item => item.length > 0))
            .then(interpreters => Promise.all(interpreters.map(interpreter => this.getInterpreterDetails(interpreter))))
            .then(interpreters => interpreters.filter(interpreter => !!interpreter).map(interpreter => interpreter));
    }
    /**
     * Return the information about the identified interpreter binary.
     */
    getInterpreterDetails(interpreter) {
        return __awaiter(this, void 0, void 0, function* () {
            const details = yield this.helper.getInterpreterInformation(interpreter);
            if (!details) {
                return;
            }
            return Object.assign({}, details, { path: interpreter, type: contracts_1.InterpreterType.Unknown });
        });
    }
    /**
     * Return the interpreters in the given directory.
     */
    getInterpretersInDirectory(dir) {
        return fs_1.fsExistsAsync(dir)
            .then(exists => exists ? helpers_1.lookForInterpretersInDirectory(dir) : Promise.resolve([]));
    }
};
KnownPathsService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(contracts_1.IKnownSearchPathsForInterpreters)),
    __param(1, inversify_1.inject(contracts_1.IInterpreterHelper)),
    __param(2, inversify_1.inject(types_3.IServiceContainer))
], KnownPathsService);
exports.KnownPathsService = KnownPathsService;
let KnownSearchPathsForInterpreters = class KnownSearchPathsForInterpreters {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
    }
    /**
     * Return the paths where Python interpreters might be found.
     */
    getSearchPaths() {
        const currentProcess = this.serviceContainer.get(types_2.ICurrentProcess);
        const platformService = this.serviceContainer.get(types_1.IPlatformService);
        const pathUtils = this.serviceContainer.get(types_2.IPathUtils);
        const searchPaths = currentProcess.env[platformService.pathVariableName]
            .split(pathUtils.delimiter)
            .map(p => p.trim())
            .filter(p => p.length > 0);
        if (!platformService.isWindows) {
            ['/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin', '/usr/local/sbin']
                .forEach(p => {
                searchPaths.push(p);
                searchPaths.push(path.join(pathUtils.home, p));
            });
            // Add support for paths such as /Users/xxx/anaconda/bin.
            if (process.env.HOME) {
                searchPaths.push(path.join(pathUtils.home, 'anaconda', 'bin'));
                searchPaths.push(path.join(pathUtils.home, 'python', 'bin'));
            }
        }
        return searchPaths;
    }
};
KnownSearchPathsForInterpreters = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_3.IServiceContainer))
], KnownSearchPathsForInterpreters);
exports.KnownSearchPathsForInterpreters = KnownSearchPathsForInterpreters;
//# sourceMappingURL=KnownPathsService.js.map