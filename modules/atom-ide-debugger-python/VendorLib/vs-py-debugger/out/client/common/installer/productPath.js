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
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:max-classes-per-file
const inversify_1 = require("inversify");
const path = require("path");
const types_1 = require("../../formatters/types");
const types_2 = require("../../ioc/types");
const types_3 = require("../../linters/types");
const types_4 = require("../../unittests/common/types");
const types_5 = require("../types");
let BaseProductPathsService = class BaseProductPathsService {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
        this.configService = serviceContainer.get(types_5.IConfigurationService);
        this.productInstaller = serviceContainer.get(types_5.IInstaller);
    }
    isExecutableAModule(product, resource) {
        let moduleName;
        try {
            moduleName = this.productInstaller.translateProductToModuleName(product, types_5.ModuleNamePurpose.run);
            // tslint:disable-next-line:no-empty
        }
        catch (_a) { }
        // User may have customized the module name or provided the fully qualifieid path.
        const executableName = this.getExecutableNameFromSettings(product, resource);
        return typeof moduleName === 'string' && moduleName.length > 0 && path.basename(executableName) === executableName;
    }
};
BaseProductPathsService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_2.IServiceContainer))
], BaseProductPathsService);
let CTagsProductPathService = class CTagsProductPathService extends BaseProductPathsService {
    constructor(serviceContainer) {
        super(serviceContainer);
    }
    getExecutableNameFromSettings(_, resource) {
        const settings = this.configService.getSettings(resource);
        return settings.workspaceSymbols.ctagsPath;
    }
};
CTagsProductPathService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_2.IServiceContainer))
], CTagsProductPathService);
exports.CTagsProductPathService = CTagsProductPathService;
let FormatterProductPathService = class FormatterProductPathService extends BaseProductPathsService {
    constructor(serviceContainer) {
        super(serviceContainer);
    }
    getExecutableNameFromSettings(product, resource) {
        const settings = this.configService.getSettings(resource);
        const formatHelper = this.serviceContainer.get(types_1.IFormatterHelper);
        const settingsPropNames = formatHelper.getSettingsPropertyNames(product);
        return settings.formatting[settingsPropNames.pathName];
    }
};
FormatterProductPathService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_2.IServiceContainer))
], FormatterProductPathService);
exports.FormatterProductPathService = FormatterProductPathService;
let LinterProductPathService = class LinterProductPathService extends BaseProductPathsService {
    constructor(serviceContainer) {
        super(serviceContainer);
    }
    getExecutableNameFromSettings(product, resource) {
        const linterManager = this.serviceContainer.get(types_3.ILinterManager);
        return linterManager.getLinterInfo(product).pathName(resource);
    }
};
LinterProductPathService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_2.IServiceContainer))
], LinterProductPathService);
exports.LinterProductPathService = LinterProductPathService;
let TestFrameworkProductPathService = class TestFrameworkProductPathService extends BaseProductPathsService {
    constructor(serviceContainer) {
        super(serviceContainer);
    }
    getExecutableNameFromSettings(product, resource) {
        const testHelper = this.serviceContainer.get(types_4.ITestsHelper);
        const settingsPropNames = testHelper.getSettingsPropertyNames(product);
        if (!settingsPropNames.pathName) {
            // E.g. in the case of UnitTests we don't allow customizing the paths.
            return this.productInstaller.translateProductToModuleName(product, types_5.ModuleNamePurpose.run);
        }
        const settings = this.configService.getSettings(resource);
        return settings.unitTest[settingsPropNames.pathName];
    }
};
TestFrameworkProductPathService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_2.IServiceContainer))
], TestFrameworkProductPathService);
exports.TestFrameworkProductPathService = TestFrameworkProductPathService;
let RefactoringLibraryProductPathService = class RefactoringLibraryProductPathService extends BaseProductPathsService {
    constructor(serviceContainer) {
        super(serviceContainer);
    }
    getExecutableNameFromSettings(product, _) {
        return this.productInstaller.translateProductToModuleName(product, types_5.ModuleNamePurpose.run);
    }
};
RefactoringLibraryProductPathService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_2.IServiceContainer))
], RefactoringLibraryProductPathService);
exports.RefactoringLibraryProductPathService = RefactoringLibraryProductPathService;
//# sourceMappingURL=productPath.js.map