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
const types_1 = require("../../common/application/types");
const settings = require("../../common/configSettings");
const constants_1 = require("../../common/constants");
const types_2 = require("../../common/types");
const types_3 = require("../../ioc/types");
const contracts_1 = require("../contracts");
const types_4 = require("./types");
let InterpreterSelector = class InterpreterSelector {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
        this.disposables = [];
        this.interpreterManager = serviceContainer.get(contracts_1.IInterpreterService);
        this.workspaceService = this.serviceContainer.get(types_1.IWorkspaceService);
        this.applicationShell = this.serviceContainer.get(types_1.IApplicationShell);
        this.documentManager = this.serviceContainer.get(types_1.IDocumentManager);
        this.pathUtils = this.serviceContainer.get(types_2.IPathUtils);
        this.interpreterComparer = this.serviceContainer.get(types_4.IInterpreterComparer);
    }
    dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
    }
    initialize() {
        const commandManager = this.serviceContainer.get(types_1.ICommandManager);
        this.disposables.push(commandManager.registerCommand(constants_1.Commands.Set_Interpreter, this.setInterpreter.bind(this)));
        this.disposables.push(commandManager.registerCommand(constants_1.Commands.Set_ShebangInterpreter, this.setShebangInterpreter.bind(this)));
    }
    getSuggestions(resourceUri) {
        return __awaiter(this, void 0, void 0, function* () {
            const interpreters = yield this.interpreterManager.getInterpreters(resourceUri);
            interpreters.sort(this.interpreterComparer.compare.bind(this.interpreterComparer));
            return Promise.all(interpreters.map(item => this.suggestionToQuickPickItem(item, resourceUri)));
        });
    }
    getWorkspaceToSetPythonPath() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(this.workspaceService.workspaceFolders) || this.workspaceService.workspaceFolders.length === 0) {
                return undefined;
            }
            if (this.workspaceService.workspaceFolders.length === 1) {
                return { folderUri: this.workspaceService.workspaceFolders[0].uri, configTarget: vscode_1.ConfigurationTarget.Workspace };
            }
            // Ok we have multiple interpreters, get the user to pick a folder.
            const applicationShell = this.serviceContainer.get(types_1.IApplicationShell);
            const workspaceFolder = yield applicationShell.showWorkspaceFolderPick({ placeHolder: 'Select a workspace' });
            return workspaceFolder ? { folderUri: workspaceFolder.uri, configTarget: vscode_1.ConfigurationTarget.WorkspaceFolder } : undefined;
        });
    }
    suggestionToQuickPickItem(suggestion, workspaceUri) {
        return __awaiter(this, void 0, void 0, function* () {
            const detail = this.pathUtils.getDisplayName(suggestion.path, workspaceUri ? workspaceUri.fsPath : undefined);
            const cachedPrefix = suggestion.cachedEntry ? '(cached) ' : '';
            return {
                // tslint:disable-next-line:no-non-null-assertion
                label: suggestion.displayName,
                detail: `${cachedPrefix}${detail}`,
                path: suggestion.path
            };
        });
    }
    setInterpreter() {
        return __awaiter(this, void 0, void 0, function* () {
            const setInterpreterGlobally = !Array.isArray(this.workspaceService.workspaceFolders) || this.workspaceService.workspaceFolders.length === 0;
            let configTarget = vscode_1.ConfigurationTarget.Global;
            let wkspace;
            if (!setInterpreterGlobally) {
                const targetConfig = yield this.getWorkspaceToSetPythonPath();
                if (!targetConfig) {
                    return;
                }
                configTarget = targetConfig.configTarget;
                wkspace = targetConfig.folderUri;
            }
            const suggestions = yield this.getSuggestions(wkspace);
            const currentPythonPath = this.pathUtils.getDisplayName(settings.PythonSettings.getInstance().pythonPath, wkspace ? wkspace.fsPath : undefined);
            const quickPickOptions = {
                matchOnDetail: true,
                matchOnDescription: true,
                placeHolder: `current: ${currentPythonPath}`
            };
            const selection = yield this.applicationShell.showQuickPick(suggestions, quickPickOptions);
            if (selection !== undefined) {
                const pythonPathUpdaterService = this.serviceContainer.get(types_4.IPythonPathUpdaterServiceManager);
                yield pythonPathUpdaterService.updatePythonPath(selection.path, configTarget, 'ui', wkspace);
            }
        });
    }
    setShebangInterpreter() {
        return __awaiter(this, void 0, void 0, function* () {
            const shebangCodeLensProvider = this.serviceContainer.get(contracts_1.IShebangCodeLensProvider);
            const shebang = yield shebangCodeLensProvider.detectShebang(this.documentManager.activeTextEditor.document);
            if (!shebang) {
                return;
            }
            const isGlobalChange = !Array.isArray(this.workspaceService.workspaceFolders) || this.workspaceService.workspaceFolders.length === 0;
            const workspaceFolder = this.workspaceService.getWorkspaceFolder(this.documentManager.activeTextEditor.document.uri);
            const isWorkspaceChange = Array.isArray(this.workspaceService.workspaceFolders) && this.workspaceService.workspaceFolders.length === 1;
            const pythonPathUpdaterService = this.serviceContainer.get(types_4.IPythonPathUpdaterServiceManager);
            if (isGlobalChange) {
                yield pythonPathUpdaterService.updatePythonPath(shebang, vscode_1.ConfigurationTarget.Global, 'shebang');
                return;
            }
            if (isWorkspaceChange || !workspaceFolder) {
                yield pythonPathUpdaterService.updatePythonPath(shebang, vscode_1.ConfigurationTarget.Workspace, 'shebang', this.workspaceService.workspaceFolders[0].uri);
                return;
            }
            yield pythonPathUpdaterService.updatePythonPath(shebang, vscode_1.ConfigurationTarget.WorkspaceFolder, 'shebang', workspaceFolder.uri);
        });
    }
};
InterpreterSelector = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_3.IServiceContainer))
], InterpreterSelector);
exports.InterpreterSelector = InterpreterSelector;
//# sourceMappingURL=interpreterSelector.js.map