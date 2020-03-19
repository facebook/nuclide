// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const types_1 = require("../common/application/types");
const constants_1 = require("../common/constants");
const types_2 = require("./types");
class LinterCommands {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
        this.disposables = [];
        this.linterManager = this.serviceContainer.get(types_2.ILinterManager);
        this.appShell = this.serviceContainer.get(types_1.IApplicationShell);
        const commandManager = this.serviceContainer.get(types_1.ICommandManager);
        commandManager.registerCommand(constants_1.Commands.Set_Linter, this.setLinterAsync.bind(this));
        commandManager.registerCommand(constants_1.Commands.Enable_Linter, this.enableLintingAsync.bind(this));
        commandManager.registerCommand(constants_1.Commands.Run_Linter, this.runLinting.bind(this));
    }
    dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
    }
    setLinterAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            const linters = this.linterManager.getAllLinterInfos();
            const suggestions = linters.map(x => x.id).sort();
            const activeLinters = yield this.linterManager.getActiveLinters(true, this.settingsUri);
            let current;
            switch (activeLinters.length) {
                case 0:
                    current = 'none';
                    break;
                case 1:
                    current = activeLinters[0].id;
                    break;
                default:
                    current = 'multiple selected';
                    break;
            }
            const quickPickOptions = {
                matchOnDetail: true,
                matchOnDescription: true,
                placeHolder: `current: ${current}`
            };
            const selection = yield this.appShell.showQuickPick(suggestions, quickPickOptions);
            if (selection !== undefined) {
                const index = linters.findIndex(x => x.id === selection);
                if (activeLinters.length > 1) {
                    // tslint:disable-next-line:messages-must-be-localized
                    const response = yield this.appShell.showWarningMessage(`Multiple linters are enabled in settings. Replace with '${selection}'?`, 'Yes', 'No');
                    if (response !== 'Yes') {
                        return;
                    }
                }
                yield this.linterManager.setActiveLintersAsync([linters[index].product], this.settingsUri);
            }
        });
    }
    enableLintingAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            const options = ['on', 'off'];
            const current = (yield this.linterManager.isLintingEnabled(true, this.settingsUri)) ? options[0] : options[1];
            const quickPickOptions = {
                matchOnDetail: true,
                matchOnDescription: true,
                placeHolder: `current: ${current}`
            };
            const selection = yield this.appShell.showQuickPick(options, quickPickOptions);
            if (selection !== undefined) {
                const enable = selection === options[0];
                yield this.linterManager.enableLintingAsync(enable, this.settingsUri);
            }
        });
    }
    runLinting() {
        const engine = this.serviceContainer.get(types_2.ILintingEngine);
        return engine.lintOpenPythonFiles();
    }
    get settingsUri() {
        return vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document.uri : undefined;
    }
}
exports.LinterCommands = LinterCommands;
//# sourceMappingURL=linterCommands.js.map