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
const vscode_1 = require("vscode");
const types_1 = require("../../common/platform/types");
const types_2 = require("../../common/types");
const types_3 = require("../../ioc/types");
const contracts_1 = require("../contracts");
/**
 * Facilitates locating Python interpreters.
 */
let PythonInterpreterLocatorService = class PythonInterpreterLocatorService {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
        this.disposables = [];
        serviceContainer.get(types_2.IDisposableRegistry).push(this);
        this.platform = serviceContainer.get(types_1.IPlatformService);
        this.interpreterLocatorHelper = serviceContainer.get(contracts_1.IInterpreterLocatorHelper);
    }
    /**
     * This class should never emit events when we're locating.
     * The events will be fired by the indivitual locators retrieved in `getLocators`.
     *
     * @readonly
     * @type {Event<Promise<PythonInterpreter[]>>}
     * @memberof PythonInterpreterLocatorService
     */
    get onLocating() {
        return new vscode_1.EventEmitter().event;
    }
    /**
     * Release any held resources.
     *
     * Called by VS Code to indicate it is done with the resource.
     */
    dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
    }
    /**
     * Return the list of known Python interpreters.
     *
     * The optional resource arg may control where locators look for
     * interpreters.
     */
    getInterpreters(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const locators = this.getLocators();
            const promises = locators.map((provider) => __awaiter(this, void 0, void 0, function* () { return provider.getInterpreters(resource); }));
            const listOfInterpreters = yield Promise.all(promises);
            const items = _.flatten(listOfInterpreters)
                .filter(item => !!item)
                .map(item => item);
            return this.interpreterLocatorHelper.mergeInterpreters(items);
        });
    }
    /**
     * Return the list of applicable interpreter locators.
     *
     * The locators are pulled from the registry.
     */
    getLocators() {
        // The order of the services is important.
        // The order is important because the data sources at the bottom of the list do not contain all,
        //  the information about the interpreters (e.g. type, environment name, etc).
        // This way, the items returned from the top of the list will win, when we combine the items returned.
        const keys = [
            [contracts_1.WINDOWS_REGISTRY_SERVICE, 'win'],
            [contracts_1.CONDA_ENV_SERVICE, ''],
            [contracts_1.CONDA_ENV_FILE_SERVICE, ''],
            [contracts_1.PIPENV_SERVICE, ''],
            [contracts_1.GLOBAL_VIRTUAL_ENV_SERVICE, ''],
            [contracts_1.WORKSPACE_VIRTUAL_ENV_SERVICE, ''],
            [contracts_1.KNOWN_PATH_SERVICE, ''],
            [contracts_1.CURRENT_PATH_SERVICE, '']
        ];
        return getLocators(keys, this.platform, (key) => {
            return this.serviceContainer.get(contracts_1.IInterpreterLocatorService, key);
        });
    }
};
PythonInterpreterLocatorService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_3.IServiceContainer))
], PythonInterpreterLocatorService);
exports.PythonInterpreterLocatorService = PythonInterpreterLocatorService;
function getLocators(keys, platform, getService) {
    const locators = [];
    for (const [key, platformName] of keys) {
        if (!platform.info.matchPlatform(platformName)) {
            continue;
        }
        const locator = getService(key);
        locators.push(locator);
    }
    return locators;
}
//# sourceMappingURL=index.js.map