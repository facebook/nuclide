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
const vscode = require("vscode");
const types_1 = require("../common/application/types");
const constants_1 = require("../common/constants");
const contextKey_1 = require("../common/contextKey");
const types_2 = require("../common/types");
const types_3 = require("../ioc/types");
const constants_2 = require("./constants");
const types_4 = require("./types");
let DataScience = class DataScience {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
        this.isDisposed = false;
        this.onSettingsChanged = () => {
            const settings = this.configuration.getSettings();
            const enabled = settings.datascience.enabled;
            const editorContext = new contextKey_1.ContextKey(constants_2.EditorContexts.DataScienceEnabled, this.commandManager);
            editorContext.set(enabled).catch();
        };
        this.commandManager = this.serviceContainer.get(types_1.ICommandManager);
        this.disposableRegistry = this.serviceContainer.get(types_2.IDisposableRegistry);
        this.extensionContext = this.serviceContainer.get(types_2.IExtensionContext);
        this.dataScienceCodeLensProvider = this.serviceContainer.get(types_4.IDataScienceCodeLensProvider);
        this.commandListeners = this.serviceContainer.getAll(types_4.IDataScienceCommandListener);
        this.configuration = this.serviceContainer.get(types_2.IConfigurationService);
        this.dataScienceSurveyBanner = this.serviceContainer.get(types_2.IPythonExtensionBanner, types_2.BANNER_NAME_DS_SURVEY);
    }
    activate() {
        return __awaiter(this, void 0, void 0, function* () {
            this.registerCommands();
            this.extensionContext.subscriptions.push(vscode.languages.registerCodeLensProvider(constants_1.PYTHON, this.dataScienceCodeLensProvider));
            // Set our initial settings and sign up for changes
            this.onSettingsChanged();
            this.configuration.getSettings().addListener('change', this.onSettingsChanged);
            this.disposableRegistry.push(this);
        });
    }
    dispose() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isDisposed) {
                this.isDisposed = true;
                this.configuration.getSettings().removeListener('change', this.onSettingsChanged);
            }
        });
    }
    runAllCells(codeWatcher) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!constants_1.isTestExecution()) {
                this.dataScienceSurveyBanner.showBanner().ignoreErrors();
            }
            let activeCodeWatcher = codeWatcher;
            if (!activeCodeWatcher) {
                activeCodeWatcher = this.getCurrentCodeWatcher();
            }
            if (activeCodeWatcher) {
                return activeCodeWatcher.runAllCells();
            }
            else {
                return Promise.resolve();
            }
        });
    }
    runCell(codeWatcher, range) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!constants_1.isTestExecution()) {
                this.dataScienceSurveyBanner.showBanner().ignoreErrors();
            }
            if (codeWatcher) {
                return codeWatcher.runCell(range);
            }
            else {
                return this.runCurrentCell();
            }
        });
    }
    runCurrentCell() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!constants_1.isTestExecution()) {
                this.dataScienceSurveyBanner.showBanner().ignoreErrors();
            }
            const activeCodeWatcher = this.getCurrentCodeWatcher();
            if (activeCodeWatcher) {
                return activeCodeWatcher.runCurrentCell();
            }
            else {
                return Promise.resolve();
            }
        });
    }
    runCurrentCellAndAdvance() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!constants_1.isTestExecution()) {
                this.dataScienceSurveyBanner.showBanner().ignoreErrors();
            }
            const activeCodeWatcher = this.getCurrentCodeWatcher();
            if (activeCodeWatcher) {
                return activeCodeWatcher.runCurrentCellAndAdvance();
            }
            else {
                return Promise.resolve();
            }
        });
    }
    // Get our matching code watcher for the active document
    getCurrentCodeWatcher() {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || !activeEditor.document) {
            return undefined;
        }
        // Ask our code lens provider to find the matching code watcher for the current document
        return this.dataScienceCodeLensProvider.getCodeWatcher(activeEditor.document);
    }
    registerCommands() {
        let disposable = this.commandManager.registerCommand(constants_2.Commands.RunAllCells, this.runAllCells, this);
        this.disposableRegistry.push(disposable);
        disposable = this.commandManager.registerCommand(constants_2.Commands.RunCell, this.runCell, this);
        this.disposableRegistry.push(disposable);
        disposable = this.commandManager.registerCommand(constants_2.Commands.RunCurrentCell, this.runCurrentCell, this);
        this.disposableRegistry.push(disposable);
        disposable = this.commandManager.registerCommand(constants_2.Commands.RunCurrentCellAdvance, this.runCurrentCellAndAdvance, this);
        this.disposableRegistry.push(disposable);
        this.commandListeners.forEach((listener) => {
            listener.register(this.commandManager);
        });
    }
};
DataScience = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_3.IServiceContainer))
], DataScience);
exports.DataScience = DataScience;
//# sourceMappingURL=datascience.js.map