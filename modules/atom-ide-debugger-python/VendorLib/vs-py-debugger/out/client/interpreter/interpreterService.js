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
const path = require("path");
const vscode_1 = require("vscode");
const types_1 = require("../common/application/types");
const registry_1 = require("../common/platform/registry");
const types_2 = require("../common/platform/types");
const types_3 = require("../common/process/types");
const types_4 = require("../common/types");
const types_5 = require("../ioc/types");
const types_6 = require("./configuration/types");
const contracts_1 = require("./contracts");
const types_7 = require("./virtualEnvs/types");
const EXPITY_DURATION = 24 * 60 * 60 * 1000;
let InterpreterService = class InterpreterService {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
        this.didChangeInterpreterEmitter = new vscode_1.EventEmitter();
        this.onConfigChanged = () => {
            this.didChangeInterpreterEmitter.fire();
            const interpreterDisplay = this.serviceContainer.get(contracts_1.IInterpreterDisplay);
            interpreterDisplay.refresh()
                .catch(ex => console.error('Python Extension: display.refresh', ex));
        };
        this.locator = serviceContainer.get(contracts_1.IInterpreterLocatorService, contracts_1.INTERPRETER_LOCATOR_SERVICE);
        this.helper = serviceContainer.get(contracts_1.IInterpreterHelper);
        this.pythonPathUpdaterService = this.serviceContainer.get(types_6.IPythonPathUpdaterServiceManager);
        this.fs = this.serviceContainer.get(types_2.IFileSystem);
        this.persistentStateFactory = this.serviceContainer.get(types_4.IPersistentStateFactory);
    }
    refresh(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const interpreterDisplay = this.serviceContainer.get(contracts_1.IInterpreterDisplay);
            return interpreterDisplay.refresh(resource);
        });
    }
    initialize() {
        const disposables = this.serviceContainer.get(types_4.IDisposableRegistry);
        const documentManager = this.serviceContainer.get(types_1.IDocumentManager);
        disposables.push(documentManager.onDidChangeActiveTextEditor((e) => e ? this.refresh(e.document.uri) : undefined));
        const configService = this.serviceContainer.get(types_4.IConfigurationService);
        configService.getSettings().addListener('change', this.onConfigChanged);
    }
    getInterpreters(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const interpreters = yield this.locator.getInterpreters(resource);
            yield Promise.all(interpreters
                .filter(item => !item.displayName)
                .map((item) => __awaiter(this, void 0, void 0, function* () { return item.displayName = yield this.getDisplayName(item, resource); })));
            return interpreters;
        });
    }
    autoSetInterpreter() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(yield this.shouldAutoSetInterpreter())) {
                return;
            }
            const activeWorkspace = this.helper.getActiveWorkspaceUri();
            if (!activeWorkspace) {
                return;
            }
            // Check pipenv first.
            const pipenvService = this.serviceContainer.get(contracts_1.IInterpreterLocatorService, contracts_1.PIPENV_SERVICE);
            let interpreters = yield pipenvService.getInterpreters(activeWorkspace.folderUri);
            if (interpreters.length > 0) {
                yield this.pythonPathUpdaterService.updatePythonPath(interpreters[0].path, activeWorkspace.configTarget, 'load', activeWorkspace.folderUri);
                return;
            }
            // Now check virtual environments under the workspace root
            const virtualEnvInterpreterProvider = this.serviceContainer.get(contracts_1.IInterpreterLocatorService, contracts_1.WORKSPACE_VIRTUAL_ENV_SERVICE);
            interpreters = yield virtualEnvInterpreterProvider.getInterpreters(activeWorkspace.folderUri);
            const workspacePathUpper = activeWorkspace.folderUri.fsPath.toUpperCase();
            const interpretersInWorkspace = interpreters.filter(interpreter => vscode_1.Uri.file(interpreter.path).fsPath.toUpperCase().startsWith(workspacePathUpper));
            if (interpretersInWorkspace.length === 0) {
                return;
            }
            // Always pick the highest version by default.
            interpretersInWorkspace.sort((a, b) => a.version > b.version ? 1 : -1);
            const pythonPath = interpretersInWorkspace[0].path;
            // Ensure this new environment is at the same level as the current workspace.
            // In windows the interpreter is under scripts/python.exe on linux it is under bin/python.
            // Meaning the sub directory must be either scripts, bin or other (but only one level deep).
            const relativePath = path.dirname(pythonPath).substring(activeWorkspace.folderUri.fsPath.length);
            if (relativePath.split(path.sep).filter(l => l.length > 0).length === 2) {
                yield this.pythonPathUpdaterService.updatePythonPath(pythonPath, activeWorkspace.configTarget, 'load', activeWorkspace.folderUri);
            }
        });
    }
    dispose() {
        this.locator.dispose();
        const configService = this.serviceContainer.get(types_4.IConfigurationService);
        configService.getSettings().removeListener('change', this.onConfigChanged);
        this.didChangeInterpreterEmitter.dispose();
    }
    get onDidChangeInterpreter() {
        return this.didChangeInterpreterEmitter.event;
    }
    getActiveInterpreter(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const pythonExecutionFactory = this.serviceContainer.get(types_3.IPythonExecutionFactory);
            const pythonExecutionService = yield pythonExecutionFactory.create({ resource });
            const fullyQualifiedPath = yield pythonExecutionService.getExecutablePath().catch(() => undefined);
            // Python path is invalid or python isn't installed.
            if (!fullyQualifiedPath) {
                return;
            }
            return this.getInterpreterDetails(fullyQualifiedPath, resource);
        });
    }
    getInterpreterDetails(pythonPath, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            // If we don't have the fully qualified path, then get it.
            if (path.basename(pythonPath) === pythonPath) {
                const pythonExecutionFactory = this.serviceContainer.get(types_3.IPythonExecutionFactory);
                const pythonExecutionService = yield pythonExecutionFactory.create({ resource });
                pythonPath = yield pythonExecutionService.getExecutablePath().catch(() => '');
                // Python path is invalid or python isn't installed.
                if (!pythonPath) {
                    return;
                }
            }
            let fileHash = yield this.fs.getFileHash(pythonPath).catch(() => '');
            fileHash = fileHash ? fileHash : '';
            const store = this.persistentStateFactory.createGlobalPersistentState(`${pythonPath}.interpreter.details.v5`, undefined, EXPITY_DURATION);
            if (store.value && fileHash && store.value.fileHash === fileHash) {
                return store.value;
            }
            const fs = this.serviceContainer.get(types_2.IFileSystem);
            const interpreters = yield this.getInterpreters(resource);
            let interpreterInfo = interpreters.find(i => fs.arePathsSame(i.path, pythonPath));
            if (!interpreterInfo) {
                const interpreterHelper = this.serviceContainer.get(contracts_1.IInterpreterHelper);
                const virtualEnvManager = this.serviceContainer.get(types_7.IVirtualEnvironmentManager);
                const [info, type] = yield Promise.all([
                    interpreterHelper.getInterpreterInformation(pythonPath),
                    virtualEnvManager.getEnvironmentType(pythonPath)
                ]);
                if (!info) {
                    return;
                }
                const details = Object.assign({}, info, { path: pythonPath, type: type });
                const envName = type === contracts_1.InterpreterType.Unknown ? undefined : yield virtualEnvManager.getEnvironmentName(pythonPath, resource);
                interpreterInfo = Object.assign({}, details, { envName });
                interpreterInfo.displayName = yield this.getDisplayName(interpreterInfo, resource);
            }
            yield store.updateValue(Object.assign({}, interpreterInfo, { path: pythonPath, fileHash }));
            return interpreterInfo;
        });
    }
    /**
     * Gets the display name of an interpreter.
     * The format is `Python <Version> <bitness> (<env name>: <env type>)`
     * E.g. `Python 3.5.1 32-bit (myenv2: virtualenv)`
     * @param {Partial<PythonInterpreter>} info
     * @returns {string}
     * @memberof InterpreterService
     */
    getDisplayName(info, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const store = this.persistentStateFactory.createGlobalPersistentState(`${info.path}.interpreter.displayName.v5`, undefined, EXPITY_DURATION);
            if (store.value) {
                return store.value;
            }
            const displayNameParts = ['Python'];
            const envSuffixParts = [];
            if (info.version_info && info.version_info.length > 0) {
                displayNameParts.push(info.version_info.slice(0, 3).join('.'));
            }
            if (info.architecture) {
                displayNameParts.push(registry_1.getArchitectureDisplayName(info.architecture));
            }
            if (!info.envName && info.path && info.type && info.type === contracts_1.InterpreterType.PipEnv) {
                // If we do not have the name of the environment, then try to get it again.
                // This can happen based on the context (i.e. resource).
                // I.e. we can determine if an environment is PipEnv only when giving it the right workspacec path (i.e. resource).
                const virtualEnvMgr = this.serviceContainer.get(types_7.IVirtualEnvironmentManager);
                info.envName = yield virtualEnvMgr.getEnvironmentName(info.path, resource);
            }
            if (info.envName && info.envName.length > 0) {
                envSuffixParts.push(`'${info.envName}'`);
            }
            if (info.type) {
                const interpreterHelper = this.serviceContainer.get(contracts_1.IInterpreterHelper);
                const name = interpreterHelper.getInterpreterTypeDisplayName(info.type);
                if (name) {
                    envSuffixParts.push(name);
                }
            }
            const envSuffix = envSuffixParts.length === 0 ? '' :
                `(${envSuffixParts.join(': ')})`;
            const displayName = `${displayNameParts.join(' ')} ${envSuffix}`.trim();
            // If dealing with cached entry, then do not store the display name in cache.
            if (!info.cachedEntry) {
                yield store.updateValue(displayName);
            }
            return displayName;
        });
    }
    shouldAutoSetInterpreter() {
        return __awaiter(this, void 0, void 0, function* () {
            const activeWorkspace = this.helper.getActiveWorkspaceUri();
            if (!activeWorkspace) {
                return false;
            }
            const workspaceService = this.serviceContainer.get(types_1.IWorkspaceService);
            const pythonConfig = workspaceService.getConfiguration('python', activeWorkspace.folderUri);
            const pythonPathInConfig = pythonConfig.inspect('pythonPath');
            // If we have a value in user settings, then don't auto set the interpreter path.
            if (pythonPathInConfig && pythonPathInConfig.globalValue !== undefined && pythonPathInConfig.globalValue !== 'python') {
                return false;
            }
            if (activeWorkspace.configTarget === vscode_1.ConfigurationTarget.Workspace) {
                return pythonPathInConfig.workspaceValue === undefined || pythonPathInConfig.workspaceValue === 'python';
            }
            if (activeWorkspace.configTarget === vscode_1.ConfigurationTarget.WorkspaceFolder) {
                return pythonPathInConfig.workspaceFolderValue === undefined || pythonPathInConfig.workspaceFolderValue === 'python';
            }
            return false;
        });
    }
};
InterpreterService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_5.IServiceContainer))
], InterpreterService);
exports.InterpreterService = InterpreterService;
//# sourceMappingURL=interpreterService.js.map