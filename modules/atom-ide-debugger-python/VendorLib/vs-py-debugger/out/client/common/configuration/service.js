"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
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
const configSettings_1 = require("../configSettings");
let ConfigurationService = class ConfigurationService {
    getSettings(resource) {
        return configSettings_1.PythonSettings.getInstance(resource);
    }
    updateSectionSetting(section, setting, value, resource, configTarget) {
        return __awaiter(this, void 0, void 0, function* () {
            const settingsInfo = section === 'python' ?
                configSettings_1.PythonSettings.getSettingsUriAndTarget(resource) :
                {
                    uri: resource,
                    target: configTarget ? configTarget : vscode_1.ConfigurationTarget.WorkspaceFolder
                };
            const configSection = vscode_1.workspace.getConfiguration(section, settingsInfo.uri);
            const currentValue = configSection.inspect(setting);
            if (currentValue !== undefined &&
                ((settingsInfo.target === vscode_1.ConfigurationTarget.Global && currentValue.globalValue === value) ||
                    (settingsInfo.target === vscode_1.ConfigurationTarget.Workspace && currentValue.workspaceValue === value) ||
                    (settingsInfo.target === vscode_1.ConfigurationTarget.WorkspaceFolder && currentValue.workspaceFolderValue === value))) {
                return;
            }
            yield configSection.update(setting, value, settingsInfo.target);
            yield this.verifySetting(configSection, settingsInfo.target, setting, value);
        });
    }
    updateSetting(setting, value, resource, configTarget) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.updateSectionSetting('python', setting, value, resource, configTarget);
        });
    }
    isTestExecution() {
        return process.env.VSC_PYTHON_CI_TEST === '1';
    }
    verifySetting(configSection, target, settingName, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isTestExecution()) {
                let retries = 0;
                do {
                    const setting = configSection.inspect(settingName);
                    if (!setting && value === undefined) {
                        break; // Both are unset
                    }
                    if (setting && value !== undefined) {
                        // Both specified
                        const actual = target === vscode_1.ConfigurationTarget.Global
                            ? setting.globalValue
                            : target === vscode_1.ConfigurationTarget.Workspace ? setting.workspaceValue : setting.workspaceFolderValue;
                        if (actual === value) {
                            break;
                        }
                    }
                    // Wait for settings to get refreshed.
                    yield new Promise((resolve, reject) => setTimeout(resolve, 250));
                    retries += 1;
                } while (retries < 20);
            }
        });
    }
};
ConfigurationService = __decorate([
    inversify_1.injectable()
], ConfigurationService);
exports.ConfigurationService = ConfigurationService;
//# sourceMappingURL=service.js.map