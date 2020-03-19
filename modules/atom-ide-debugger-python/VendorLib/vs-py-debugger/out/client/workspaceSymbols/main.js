"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const types_1 = require("../common/application/types");
const constants_1 = require("../common/constants");
const helpers_1 = require("../common/helpers");
const types_2 = require("../common/platform/types");
const types_3 = require("../common/process/types");
const types_4 = require("../common/types");
const generator_1 = require("./generator");
const provider_1 = require("./provider");
const MAX_NUMBER_OF_ATTEMPTS_TO_INSTALL_AND_BUILD = 2;
class WorkspaceSymbols {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
        this.generators = [];
        this.outputChannel = this.serviceContainer.get(types_4.IOutputChannel, constants_1.STANDARD_OUTPUT_CHANNEL);
        this.commandMgr = this.serviceContainer.get(types_1.ICommandManager);
        this.fs = this.serviceContainer.get(types_2.IFileSystem);
        this.workspace = this.serviceContainer.get(types_1.IWorkspaceService);
        this.disposables = [];
        this.disposables.push(this.outputChannel);
        this.registerCommands();
        this.initializeGenerators();
        vscode_1.languages.registerWorkspaceSymbolProvider(new provider_1.WorkspaceSymbolProvider(this.fs, this.commandMgr, this.generators));
        this.disposables.push(this.workspace.onDidChangeWorkspaceFolders(() => this.initializeGenerators()));
    }
    dispose() {
        this.disposables.forEach(d => d.dispose());
    }
    initializeGenerators() {
        while (this.generators.length > 0) {
            const generator = this.generators.shift();
            generator.dispose();
        }
        if (Array.isArray(this.workspace.workspaceFolders)) {
            this.workspace.workspaceFolders.forEach(wkSpc => {
                const processServiceFactory = this.serviceContainer.get(types_3.IProcessServiceFactory);
                this.generators.push(new generator_1.Generator(wkSpc.uri, this.outputChannel, processServiceFactory));
            });
        }
    }
    registerCommands() {
        this.disposables.push(this.commandMgr.registerCommand(constants_1.Commands.Build_Workspace_Symbols, (rebuild = true, token) => __awaiter(this, void 0, void 0, function* () {
            const promises = this.buildWorkspaceSymbols(rebuild, token);
            return Promise.all(promises);
        })));
    }
    // tslint:disable-next-line:no-any
    buildWorkspaceSymbols(rebuild = true, token) {
        if (token && token.isCancellationRequested) {
            return [];
        }
        if (this.generators.length === 0) {
            return [];
        }
        let promptPromise;
        let promptResponse;
        return this.generators.map((generator) => __awaiter(this, void 0, void 0, function* () {
            if (!generator.enabled) {
                return;
            }
            const exists = yield this.fs.fileExists(generator.tagFilePath);
            // If file doesn't exist, then run the ctag generator,
            // or check if required to rebuild.
            if (!rebuild && exists) {
                return;
            }
            for (let counter = 0; counter < MAX_NUMBER_OF_ATTEMPTS_TO_INSTALL_AND_BUILD; counter += 1) {
                try {
                    yield generator.generateWorkspaceTags();
                    return;
                }
                catch (error) {
                    if (!helpers_1.isNotInstalledError(error)) {
                        this.outputChannel.show();
                        return;
                    }
                }
                if (!token || token.isCancellationRequested) {
                    return;
                }
                // Display prompt once for all workspaces.
                if (promptPromise) {
                    promptResponse = yield promptPromise;
                    continue;
                }
                else {
                    const installer = this.serviceContainer.get(types_4.IInstaller);
                    promptPromise = installer.promptToInstall(types_4.Product.ctags, this.workspace.workspaceFolders[0].uri);
                    promptResponse = yield promptPromise;
                }
                if (promptResponse !== types_4.InstallerResponse.Installed || (!token || token.isCancellationRequested)) {
                    return;
                }
            }
        }));
    }
}
exports.WorkspaceSymbols = WorkspaceSymbols;
//# sourceMappingURL=main.js.map