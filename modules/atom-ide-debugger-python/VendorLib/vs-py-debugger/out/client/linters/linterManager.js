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
const types_1 = require("../common/application/types");
const types_2 = require("../common/types");
const types_3 = require("../ioc/types");
const bandit_1 = require("./bandit");
const flake8_1 = require("./flake8");
const linterInfo_1 = require("./linterInfo");
const mypy_1 = require("./mypy");
const pep8_1 = require("./pep8");
const prospector_1 = require("./prospector");
const pydocstyle_1 = require("./pydocstyle");
const pylama_1 = require("./pylama");
const pylint_1 = require("./pylint");
const types_4 = require("./types");
class DisabledLinter {
    constructor(configService) {
        this.configService = configService;
    }
    get info() {
        return new linterInfo_1.LinterInfo(types_2.Product.pylint, 'pylint', this.configService);
    }
    lint(document, cancellation) {
        return __awaiter(this, void 0, void 0, function* () {
            return [];
        });
    }
}
let LinterManager = class LinterManager {
    constructor(serviceContainer, workspaceService) {
        this.serviceContainer = serviceContainer;
        this.workspaceService = workspaceService;
        this.checkedForInstalledLinters = new Set();
        this.configService = serviceContainer.get(types_2.IConfigurationService);
        this.linters = [
            new linterInfo_1.LinterInfo(types_2.Product.bandit, 'bandit', this.configService),
            new linterInfo_1.LinterInfo(types_2.Product.flake8, 'flake8', this.configService),
            new linterInfo_1.PylintLinterInfo(this.configService, this.workspaceService, ['.pylintrc', 'pylintrc']),
            new linterInfo_1.LinterInfo(types_2.Product.mypy, 'mypy', this.configService),
            new linterInfo_1.LinterInfo(types_2.Product.pep8, 'pep8', this.configService),
            new linterInfo_1.LinterInfo(types_2.Product.prospector, 'prospector', this.configService),
            new linterInfo_1.LinterInfo(types_2.Product.pydocstyle, 'pydocstyle', this.configService),
            new linterInfo_1.LinterInfo(types_2.Product.pylama, 'pylama', this.configService)
        ];
    }
    getAllLinterInfos() {
        return this.linters;
    }
    getLinterInfo(product) {
        const x = this.linters.findIndex((value, index, obj) => value.product === product);
        if (x >= 0) {
            return this.linters[x];
        }
        throw new Error('Invalid linter');
    }
    isLintingEnabled(silent, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const settings = this.configService.getSettings(resource);
            const activeLintersPresent = yield this.getActiveLinters(silent, resource);
            return settings.linting.enabled && activeLintersPresent.length > 0;
        });
    }
    enableLintingAsync(enable, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.configService.updateSetting('linting.enabled', enable, resource);
        });
    }
    getActiveLinters(silent, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!silent) {
                yield this.enableUnconfiguredLinters(resource);
            }
            return this.linters.filter(x => x.isEnabled(resource));
        });
    }
    setActiveLintersAsync(products, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            // ensure we only allow valid linters to be set, otherwise leave things alone.
            // filter out any invalid products:
            const validProducts = products.filter(product => {
                const foundIndex = this.linters.findIndex(validLinter => validLinter.product === product);
                return foundIndex !== -1;
            });
            // if we have valid linter product(s), enable only those
            if (validProducts.length > 0) {
                const active = yield this.getActiveLinters(true, resource);
                for (const x of active) {
                    yield x.enableAsync(false, resource);
                }
                if (products.length > 0) {
                    const toActivate = this.linters.filter(x => products.findIndex(p => x.product === p) >= 0);
                    for (const x of toActivate) {
                        yield x.enableAsync(true, resource);
                    }
                    yield this.enableLintingAsync(true, resource);
                }
            }
        });
    }
    createLinter(product, outputChannel, serviceContainer, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(yield this.isLintingEnabled(true, resource))) {
                return new DisabledLinter(this.configService);
            }
            const error = 'Linter manager: Unknown linter';
            switch (product) {
                case types_2.Product.bandit:
                    return new bandit_1.Bandit(outputChannel, serviceContainer);
                case types_2.Product.flake8:
                    return new flake8_1.Flake8(outputChannel, serviceContainer);
                case types_2.Product.pylint:
                    return new pylint_1.Pylint(outputChannel, serviceContainer);
                case types_2.Product.mypy:
                    return new mypy_1.MyPy(outputChannel, serviceContainer);
                case types_2.Product.prospector:
                    return new prospector_1.Prospector(outputChannel, serviceContainer);
                case types_2.Product.pylama:
                    return new pylama_1.PyLama(outputChannel, serviceContainer);
                case types_2.Product.pydocstyle:
                    return new pydocstyle_1.PyDocStyle(outputChannel, serviceContainer);
                case types_2.Product.pep8:
                    return new pep8_1.Pep8(outputChannel, serviceContainer);
                default:
                    serviceContainer.get(types_2.ILogger).logError(error);
                    break;
            }
            throw new Error(error);
        });
    }
    enableUnconfiguredLinters(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const settings = this.configService.getSettings(resource);
            if (!settings.linting.pylintEnabled || !settings.linting.enabled) {
                return;
            }
            // If we've already checked during this session for the same workspace and Python path, then don't bother again.
            const workspaceKey = `${this.workspaceService.getWorkspaceFolderIdentifier(resource)}${settings.pythonPath}`;
            if (this.checkedForInstalledLinters.has(workspaceKey)) {
                return;
            }
            this.checkedForInstalledLinters.add(workspaceKey);
            // only check & ask the user if they'd like to enable pylint
            const pylintInfo = this.linters.find(linter => linter.id === 'pylint');
            const activator = this.serviceContainer.get(types_4.IAvailableLinterActivator);
            yield activator.promptIfLinterAvailable(pylintInfo, resource);
        });
    }
};
LinterManager = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_3.IServiceContainer)),
    __param(1, inversify_1.inject(types_1.IWorkspaceService))
], LinterManager);
exports.LinterManager = LinterManager;
//# sourceMappingURL=linterManager.js.map