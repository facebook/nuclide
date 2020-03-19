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
const types_1 = require("../common/application/types");
const types_2 = require("../common/platform/types");
const types_3 = require("../common/process/types");
const types_4 = require("../common/types");
const types_5 = require("../ioc/types");
const contracts_1 = require("./contracts");
const EXPITY_DURATION = 24 * 60 * 60 * 1000;
function getFirstNonEmptyLineFromMultilineString(stdout) {
    if (!stdout) {
        return '';
    }
    const lines = stdout.split(/\r?\n/g).map(line => line.trim()).filter(line => line.length > 0);
    return lines.length > 0 ? lines[0] : '';
}
exports.getFirstNonEmptyLineFromMultilineString = getFirstNonEmptyLineFromMultilineString;
let InterpreterHelper = class InterpreterHelper {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
        this.persistentFactory = this.serviceContainer.get(types_4.IPersistentStateFactory);
        this.fs = this.serviceContainer.get(types_2.IFileSystem);
    }
    getActiveWorkspaceUri() {
        const workspaceService = this.serviceContainer.get(types_1.IWorkspaceService);
        const documentManager = this.serviceContainer.get(types_1.IDocumentManager);
        if (!workspaceService.hasWorkspaceFolders) {
            return;
        }
        if (Array.isArray(workspaceService.workspaceFolders) && workspaceService.workspaceFolders.length === 1) {
            return { folderUri: workspaceService.workspaceFolders[0].uri, configTarget: vscode_1.ConfigurationTarget.Workspace };
        }
        if (documentManager.activeTextEditor) {
            const workspaceFolder = workspaceService.getWorkspaceFolder(documentManager.activeTextEditor.document.uri);
            if (workspaceFolder) {
                return { configTarget: vscode_1.ConfigurationTarget.WorkspaceFolder, folderUri: workspaceFolder.uri };
            }
        }
    }
    getInterpreterInformation(pythonPath) {
        return __awaiter(this, void 0, void 0, function* () {
            let fileHash = yield this.fs.getFileHash(pythonPath).catch(() => '');
            fileHash = fileHash ? fileHash : '';
            const store = this.persistentFactory.createGlobalPersistentState(`${pythonPath}.v2`, undefined, EXPITY_DURATION);
            if (store.value && fileHash && store.value.fileHash === fileHash) {
                return store.value;
            }
            const processService = yield this.serviceContainer.get(types_3.IPythonExecutionFactory).create({ pythonPath });
            try {
                const info = yield processService.getInterpreterInformation().catch(() => undefined);
                if (!info) {
                    return;
                }
                const details = Object.assign({}, (info), { fileHash });
                yield store.updateValue(details);
                return details;
            }
            catch (ex) {
                console.error(`Failed to get interpreter information for '${pythonPath}'`, ex);
                return;
            }
        });
    }
    isMacDefaultPythonPath(pythonPath) {
        return pythonPath === 'python' || pythonPath === '/usr/bin/python';
    }
    getInterpreterTypeDisplayName(interpreterType) {
        switch (interpreterType) {
            case contracts_1.InterpreterType.Conda: {
                return 'conda';
            }
            case contracts_1.InterpreterType.PipEnv: {
                return 'pipenv';
            }
            case contracts_1.InterpreterType.Pyenv: {
                return 'pyenv';
            }
            case contracts_1.InterpreterType.Venv: {
                return 'venv';
            }
            case contracts_1.InterpreterType.VirtualEnv: {
                return 'virtualenv';
            }
            default: {
                return '';
            }
        }
    }
};
InterpreterHelper = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_5.IServiceContainer))
], InterpreterHelper);
exports.InterpreterHelper = InterpreterHelper;
//# sourceMappingURL=helpers.js.map