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
// tslint:disable:no-invalid-template-strings
const inversify_1 = require("inversify");
const path = require("path");
const vscode_1 = require("vscode");
const invalidPythonPathInDebugger_1 = require("../../../application/diagnostics/checks/invalidPythonPathInDebugger");
const types_1 = require("../../../application/diagnostics/types");
const types_2 = require("../../../common/application/types");
const constants_1 = require("../../../common/constants");
const types_3 = require("../../../common/types");
let BaseConfigurationProvider = class BaseConfigurationProvider {
    constructor(debugType, serviceContainer) {
        this.debugType = debugType;
        this.serviceContainer = serviceContainer;
    }
    resolveDebugConfiguration(folder, debugConfiguration, token) {
        return __awaiter(this, void 0, void 0, function* () {
            const workspaceFolder = this.getWorkspaceFolder(folder);
            if (debugConfiguration.request === 'attach') {
                yield this.provideAttachDefaults(workspaceFolder, debugConfiguration);
            }
            else {
                const config = debugConfiguration;
                const numberOfSettings = Object.keys(config);
                if ((config.noDebug === true && numberOfSettings.length === 1) || numberOfSettings.length === 0) {
                    const defaultProgram = this.getProgram();
                    config.name = 'Launch';
                    config.type = this.debugType;
                    config.request = 'launch';
                    config.program = defaultProgram ? defaultProgram : '';
                    config.env = {};
                }
                yield this.provideLaunchDefaults(workspaceFolder, config);
                const isValid = yield this.validateLaunchConfiguration(config);
                if (!isValid) {
                    return;
                }
            }
            const dbgConfig = debugConfiguration;
            if (Array.isArray(dbgConfig.debugOptions)) {
                dbgConfig.debugOptions = dbgConfig.debugOptions.filter((item, pos) => dbgConfig.debugOptions.indexOf(item) === pos);
            }
            return debugConfiguration;
        });
    }
    provideAttachDefaults(workspaceFolder, debugConfiguration) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(debugConfiguration.debugOptions)) {
                debugConfiguration.debugOptions = [];
            }
            if (!debugConfiguration.host) {
                debugConfiguration.host = 'localhost';
            }
            // Pass workspace folder so we can get this when we get debug events firing.
            debugConfiguration.workspaceFolder = workspaceFolder ? workspaceFolder.fsPath : undefined;
        });
    }
    provideLaunchDefaults(workspaceFolder, debugConfiguration) {
        return __awaiter(this, void 0, void 0, function* () {
            this.resolveAndUpdatePythonPath(workspaceFolder, debugConfiguration);
            if (typeof debugConfiguration.cwd !== 'string' && workspaceFolder) {
                debugConfiguration.cwd = workspaceFolder.fsPath;
            }
            if (typeof debugConfiguration.envFile !== 'string' && workspaceFolder) {
                const envFile = path.join(workspaceFolder.fsPath, '.env');
                debugConfiguration.envFile = envFile;
            }
            if (typeof debugConfiguration.stopOnEntry !== 'boolean') {
                debugConfiguration.stopOnEntry = false;
            }
            if (typeof debugConfiguration.showReturnValue !== 'boolean') {
                debugConfiguration.showReturnValue = false;
            }
            if (!debugConfiguration.console) {
                debugConfiguration.console = 'integratedTerminal';
            }
            // If using a terminal, then never open internal console.
            if (debugConfiguration.console !== 'none' && !debugConfiguration.internalConsoleOptions) {
                debugConfiguration.internalConsoleOptions = 'neverOpen';
            }
            if (!Array.isArray(debugConfiguration.debugOptions)) {
                debugConfiguration.debugOptions = [];
            }
            // Pass workspace folder so we can get this when we get debug events firing.
            debugConfiguration.workspaceFolder = workspaceFolder ? workspaceFolder.fsPath : undefined;
        });
    }
    validateLaunchConfiguration(debugConfiguration) {
        return __awaiter(this, void 0, void 0, function* () {
            const diagnosticService = this.serviceContainer.get(types_1.IDiagnosticsService, invalidPythonPathInDebugger_1.InvalidPythonPathInDebuggerServiceId);
            return diagnosticService.validatePythonPath(debugConfiguration.pythonPath);
        });
    }
    getWorkspaceFolder(folder) {
        if (folder) {
            return folder.uri;
        }
        const program = this.getProgram();
        const workspaceService = this.serviceContainer.get(types_2.IWorkspaceService);
        if (!Array.isArray(workspaceService.workspaceFolders) || workspaceService.workspaceFolders.length === 0) {
            return program ? vscode_1.Uri.file(path.dirname(program)) : undefined;
        }
        if (workspaceService.workspaceFolders.length === 1) {
            return workspaceService.workspaceFolders[0].uri;
        }
        if (program) {
            const workspaceFolder = workspaceService.getWorkspaceFolder(vscode_1.Uri.file(program));
            if (workspaceFolder) {
                return workspaceFolder.uri;
            }
        }
    }
    getProgram() {
        const documentManager = this.serviceContainer.get(types_2.IDocumentManager);
        const editor = documentManager.activeTextEditor;
        if (editor && editor.document.languageId === constants_1.PYTHON_LANGUAGE) {
            return editor.document.fileName;
        }
    }
    resolveAndUpdatePythonPath(workspaceFolder, debugConfiguration) {
        if (!debugConfiguration) {
            return;
        }
        if (debugConfiguration.pythonPath === '${config:python.pythonPath}' || !debugConfiguration.pythonPath) {
            const configService = this.serviceContainer.get(types_3.IConfigurationService);
            const pythonPath = configService.getSettings(workspaceFolder).pythonPath;
            debugConfiguration.pythonPath = pythonPath;
        }
    }
};
BaseConfigurationProvider = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.unmanaged())
], BaseConfigurationProvider);
exports.BaseConfigurationProvider = BaseConfigurationProvider;
//# sourceMappingURL=baseProvider.js.map