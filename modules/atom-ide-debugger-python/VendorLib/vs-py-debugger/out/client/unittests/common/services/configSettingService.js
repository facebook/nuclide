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
const vscode_1 = require("vscode");
const types_1 = require("../../../common/application/types");
const types_2 = require("../../../common/types");
const types_3 = require("../../../ioc/types");
let TestConfigSettingsService = class TestConfigSettingsService {
    constructor(serviceContainer) {
        this.workspaceService = serviceContainer.get(types_1.IWorkspaceService);
    }
    updateTestArgs(testDirectory, product, args) {
        return __awaiter(this, void 0, void 0, function* () {
            const setting = this.getTestArgSetting(product);
            return this.updateSetting(testDirectory, setting, args);
        });
    }
    enable(testDirectory, product) {
        return __awaiter(this, void 0, void 0, function* () {
            const setting = this.getTestEnablingSetting(product);
            return this.updateSetting(testDirectory, setting, true);
        });
    }
    disable(testDirectory, product) {
        return __awaiter(this, void 0, void 0, function* () {
            const setting = this.getTestEnablingSetting(product);
            return this.updateSetting(testDirectory, setting, false);
        });
    }
    getTestArgSetting(product) {
        switch (product) {
            case types_2.Product.unittest:
                return 'unitTest.unittestArgs';
            case types_2.Product.pytest:
                return 'unitTest.pyTestArgs';
            case types_2.Product.nosetest:
                return 'unitTest.nosetestArgs';
            default:
                throw new Error('Invalid Test Product');
        }
    }
    getTestEnablingSetting(product) {
        switch (product) {
            case types_2.Product.unittest:
                return 'unitTest.unittestEnabled';
            case types_2.Product.pytest:
                return 'unitTest.pyTestEnabled';
            case types_2.Product.nosetest:
                return 'unitTest.nosetestsEnabled';
            default:
                throw new Error('Invalid Test Product');
        }
    }
    // tslint:disable-next-line:no-any
    updateSetting(testDirectory, setting, value) {
        return __awaiter(this, void 0, void 0, function* () {
            let pythonConfig;
            const resource = typeof testDirectory === 'string' ? vscode_1.Uri.file(testDirectory) : testDirectory;
            if (!this.workspaceService.hasWorkspaceFolders) {
                pythonConfig = this.workspaceService.getConfiguration('python');
            }
            else if (this.workspaceService.workspaceFolders.length === 1) {
                pythonConfig = this.workspaceService.getConfiguration('python', this.workspaceService.workspaceFolders[0].uri);
            }
            else {
                const workspaceFolder = this.workspaceService.getWorkspaceFolder(resource);
                if (!workspaceFolder) {
                    throw new Error(`Test directory does not belong to any workspace (${testDirectory})`);
                }
                // tslint:disable-next-line:no-non-null-assertion
                pythonConfig = this.workspaceService.getConfiguration('python', workspaceFolder.uri);
            }
            return pythonConfig.update(setting, value);
        });
    }
};
TestConfigSettingsService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_3.IServiceContainer))
], TestConfigSettingsService);
exports.TestConfigSettingsService = TestConfigSettingsService;
//# sourceMappingURL=configSettingService.js.map