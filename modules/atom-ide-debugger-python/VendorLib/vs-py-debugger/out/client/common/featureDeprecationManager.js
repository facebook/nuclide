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
const types_1 = require("./application/types");
const browser_1 = require("./net/browser");
const types_2 = require("./types");
const deprecatedFeatures = [
    {
        doNotDisplayPromptStateKey: 'SHOW_DEPRECATED_FEATURE_PROMPT_FORMAT_ON_SAVE',
        message: 'The setting \'python.formatting.formatOnSave\' is deprecated, please use \'editor.formatOnSave\'.',
        moreInfoUrl: 'https://github.com/Microsoft/vscode-python/issues/309',
        setting: { setting: 'formatting.formatOnSave', values: ['true', true] }
    },
    {
        doNotDisplayPromptStateKey: 'SHOW_DEPRECATED_FEATURE_PROMPT_LINT_ON_TEXT_CHANGE',
        message: 'The setting \'python.linting.lintOnTextChange\' is deprecated, please enable \'python.linting.lintOnSave\' and \'files.autoSave\'.',
        moreInfoUrl: 'https://github.com/Microsoft/vscode-python/issues/313',
        setting: { setting: 'linting.lintOnTextChange', values: ['true', true] }
    },
    {
        doNotDisplayPromptStateKey: 'SHOW_DEPRECATED_FEATURE_PROMPT_FOR_AUTO_COMPLETE_PRELOAD_MODULES',
        message: 'The setting \'python.autoComplete.preloadModules\' is deprecated, please consider using the new Language Server (\'python.jediEnabled = false\').',
        moreInfoUrl: 'https://github.com/Microsoft/vscode-python/issues/1704',
        setting: { setting: 'autoComplete.preloadModules' }
    }
];
let FeatureDeprecationManager = class FeatureDeprecationManager {
    constructor(persistentStateFactory, cmdMgr, workspace, appShell) {
        this.persistentStateFactory = persistentStateFactory;
        this.cmdMgr = cmdMgr;
        this.workspace = workspace;
        this.appShell = appShell;
        this.disposables = [];
    }
    dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
    }
    initialize() {
        deprecatedFeatures.forEach(this.registerDeprecation.bind(this));
    }
    registerDeprecation(deprecatedInfo) {
        if (Array.isArray(deprecatedInfo.commands)) {
            deprecatedInfo.commands.forEach(cmd => {
                this.disposables.push(this.cmdMgr.registerCommand(cmd, () => this.notifyDeprecation(deprecatedInfo), this));
            });
        }
        if (deprecatedInfo.setting) {
            this.checkAndNotifyDeprecatedSetting(deprecatedInfo);
        }
    }
    notifyDeprecation(deprecatedInfo) {
        return __awaiter(this, void 0, void 0, function* () {
            const notificationPromptEnabled = this.persistentStateFactory.createGlobalPersistentState(deprecatedInfo.doNotDisplayPromptStateKey, true);
            if (!notificationPromptEnabled.value) {
                return;
            }
            const moreInfo = 'Learn more';
            const doNotShowAgain = 'Never show again';
            const option = yield this.appShell.showInformationMessage(deprecatedInfo.message, moreInfo, doNotShowAgain);
            if (!option) {
                return;
            }
            switch (option) {
                case moreInfo: {
                    browser_1.launch(deprecatedInfo.moreInfoUrl);
                    break;
                }
                case doNotShowAgain: {
                    yield notificationPromptEnabled.updateValue(false);
                    break;
                }
                default: {
                    throw new Error('Selected option not supported.');
                }
            }
            return;
        });
    }
    checkAndNotifyDeprecatedSetting(deprecatedInfo) {
        let notify = false;
        if (Array.isArray(this.workspace.workspaceFolders) && this.workspace.workspaceFolders.length > 0) {
            this.workspace.workspaceFolders.forEach(workspaceFolder => {
                if (notify) {
                    return;
                }
                notify = this.isDeprecatedSettingAndValueUsed(this.workspace.getConfiguration('python', workspaceFolder.uri), deprecatedInfo.setting);
            });
        }
        else {
            notify = this.isDeprecatedSettingAndValueUsed(this.workspace.getConfiguration('python'), deprecatedInfo.setting);
        }
        if (notify) {
            this.notifyDeprecation(deprecatedInfo)
                .catch(ex => console.error('Python Extension: notifyDeprecation', ex));
        }
    }
    isDeprecatedSettingAndValueUsed(pythonConfig, deprecatedSetting) {
        if (!pythonConfig.has(deprecatedSetting.setting)) {
            return false;
        }
        const configValue = pythonConfig.get(deprecatedSetting.setting);
        if (!Array.isArray(deprecatedSetting.values) || deprecatedSetting.values.length === 0) {
            if (Array.isArray(configValue)) {
                return configValue.length > 0;
            }
            return true;
        }
        if (!Array.isArray(deprecatedSetting.values) || deprecatedSetting.values.length === 0) {
            if (configValue === undefined) {
                return false;
            }
            if (Array.isArray(configValue)) {
                // tslint:disable-next-line:no-any
                return configValue.length > 0;
            }
            // If we have a value in the setting, then return.
            return true;
        }
        return deprecatedSetting.values.indexOf(pythonConfig.get(deprecatedSetting.setting)) >= 0;
    }
};
FeatureDeprecationManager = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_2.IPersistentStateFactory)),
    __param(1, inversify_1.inject(types_1.ICommandManager)),
    __param(2, inversify_1.inject(types_1.IWorkspaceService)),
    __param(3, inversify_1.inject(types_1.IApplicationShell))
], FeatureDeprecationManager);
exports.FeatureDeprecationManager = FeatureDeprecationManager;
//# sourceMappingURL=featureDeprecationManager.js.map