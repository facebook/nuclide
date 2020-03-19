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
const path = require("path");
const vscode_languageclient_1 = require("vscode-languageclient");
const types_1 = require("../../common/application/types");
// tslint:disable-next-line:ordered-imports
const constants_1 = require("../../common/constants");
const types_2 = require("../../common/platform/types");
const types_3 = require("../../common/types");
const async_1 = require("../../common/utils/async");
const stopWatch_1 = require("../../common/utils/stopWatch");
const types_4 = require("../../common/variables/types");
const types_5 = require("../../ioc/types");
const symbolProvider_1 = require("../../providers/symbolProvider");
const telemetry_1 = require("../../telemetry");
const constants_2 = require("../../telemetry/constants");
const types_6 = require("../../unittests/types");
const downloader_1 = require("../downloader");
const interpreterDataService_1 = require("../interpreterDataService");
const platformData_1 = require("../platformData");
const progress_1 = require("../progress");
const types_7 = require("../types");
const PYTHON = 'python';
const dotNetCommand = 'dotnet';
const languageClientName = 'Python Tools';
const loadExtensionCommand = 'python._loadLanguageServerExtension';
const buildSymbolsCmdDeprecatedInfo = {
    doNotDisplayPromptStateKey: 'SHOW_DEPRECATED_FEATURE_PROMPT_BUILD_WORKSPACE_SYMBOLS',
    message: 'The command \'Python: Build Workspace Symbols\' is deprecated when using the Python Language Server. The Python Language Server builds symbols in the workspace in the background.',
    moreInfoUrl: 'https://github.com/Microsoft/vscode-python/issues/2267#issuecomment-408996859',
    commands: ['python.buildWorkspaceSymbols']
};
let LanguageServerExtensionActivator = class LanguageServerExtensionActivator {
    constructor(services) {
        this.services = services;
        this.sw = new stopWatch_1.StopWatch();
        this.disposables = [];
        this.interpreterHash = '';
        this.excludedFiles = [];
        this.typeshedPaths = [];
        this.context = this.services.get(types_3.IExtensionContext);
        this.configuration = this.services.get(types_3.IConfigurationService);
        this.appShell = this.services.get(types_1.IApplicationShell);
        this.output = this.services.get(types_3.IOutputChannel, constants_1.STANDARD_OUTPUT_CHANNEL);
        this.fs = this.services.get(types_2.IFileSystem);
        this.platformData = new platformData_1.PlatformData(services.get(types_2.IPlatformService), this.fs);
        this.workspace = this.services.get(types_1.IWorkspaceService);
        this.languageServerFolderService = this.services.get(types_7.ILanguageServerFolderService);
        const deprecationManager = this.services.get(types_3.IFeatureDeprecationManager);
        // Currently only a single root. Multi-root support is future.
        this.root = this.workspace && this.workspace.hasWorkspaceFolders
            ? this.workspace.workspaceFolders[0].uri : undefined;
        this.startupCompleted = async_1.createDeferred();
        const commandManager = this.services.get(types_1.ICommandManager);
        this.disposables.push(commandManager.registerCommand(loadExtensionCommand, (args) => __awaiter(this, void 0, void 0, function* () {
            if (this.languageClient) {
                yield this.startupCompleted.promise;
                this.languageClient.sendRequest('python/loadExtension', args);
            }
            else {
                this.loadExtensionArgs = args;
            }
        })));
        deprecationManager.registerDeprecation(buildSymbolsCmdDeprecatedInfo);
        this.surveyBanner = services.get(types_3.IPythonExtensionBanner, types_3.BANNER_NAME_LS_SURVEY);
        this.configuration.getSettings().addListener('change', this.onSettingsChanged.bind(this));
    }
    activate() {
        return __awaiter(this, void 0, void 0, function* () {
            this.sw.reset();
            this.languageServerFolder = yield this.languageServerFolderService.getLanguageServerFolderName();
            const clientOptions = yield this.getAnalysisOptions();
            if (!clientOptions) {
                return false;
            }
            this.startupCompleted.promise.then(() => {
                const testManagementService = this.services.get(types_6.IUnitTestManagementService);
                testManagementService.activate()
                    .then(() => testManagementService.activateCodeLenses(new symbolProvider_1.LanguageServerSymbolProvider(this.languageClient)))
                    .catch(ex => this.services.get(types_3.ILogger).logError('Failed to activate Unit Tests', ex));
            }).ignoreErrors();
            return this.startLanguageServer(clientOptions);
        });
    }
    deactivate() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.languageClient) {
                // Do not await on this
                this.languageClient.stop();
            }
            for (const d of this.disposables) {
                d.dispose();
            }
            this.configuration.getSettings().removeListener('change', this.onSettingsChanged.bind(this));
        });
    }
    startLanguageServer(clientOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            // Determine if we are running MSIL/Universal via dotnet or self-contained app.
            telemetry_1.sendTelemetryEvent(constants_2.PYTHON_LANGUAGE_SERVER_ENABLED);
            const settings = this.configuration.getSettings();
            if (!settings.downloadLanguageServer) {
                // Depends on .NET Runtime or SDK. Typically development-only case.
                this.languageClient = this.createSimpleLanguageClient(clientOptions);
                yield this.startLanguageClient();
                return true;
            }
            const mscorlib = path.join(this.context.extensionPath, this.languageServerFolder, 'mscorlib.dll');
            if (!(yield this.fs.fileExists(mscorlib))) {
                const downloader = new downloader_1.LanguageServerDownloader(this.platformData, this.languageServerFolder, this.services);
                yield downloader.downloadLanguageServer(this.context);
            }
            const serverModule = path.join(this.context.extensionPath, this.languageServerFolder, this.platformData.getEngineExecutableName());
            this.languageClient = this.createSelfContainedLanguageClient(serverModule, clientOptions);
            try {
                yield this.startLanguageClient();
                this.languageClient.onTelemetry(telemetryEvent => {
                    const eventName = telemetryEvent.EventName ? telemetryEvent.EventName : constants_2.PYTHON_LANGUAGE_SERVER_TELEMETRY;
                    telemetry_1.sendTelemetryEvent(eventName, telemetryEvent.Measurements, telemetryEvent.Properties);
                });
                return true;
            }
            catch (ex) {
                this.appShell.showErrorMessage(`Language server failed to start. Error ${ex}`);
                telemetry_1.sendTelemetryEvent(constants_2.PYTHON_LANGUAGE_SERVER_ERROR, undefined, { error: 'Failed to start (platform)' });
                return false;
            }
        });
    }
    startLanguageClient() {
        return __awaiter(this, void 0, void 0, function* () {
            this.context.subscriptions.push(this.languageClient.start());
            yield this.serverReady();
            const disposables = this.services.get(types_3.IDisposableRegistry);
            const progressReporting = new progress_1.ProgressReporting(this.languageClient);
            disposables.push(progressReporting);
        });
    }
    serverReady() {
        return __awaiter(this, void 0, void 0, function* () {
            while (!this.languageClient.initializeResult) {
                yield new Promise(resolve => setTimeout(resolve, 100));
            }
            if (this.loadExtensionArgs) {
                this.languageClient.sendRequest('python/loadExtension', this.loadExtensionArgs);
            }
            this.startupCompleted.resolve();
        });
    }
    createSimpleLanguageClient(clientOptions) {
        const commandOptions = { stdio: 'pipe' };
        const serverModule = path.join(this.context.extensionPath, this.languageServerFolder, this.platformData.getEngineDllName());
        const serverOptions = {
            run: { command: dotNetCommand, args: [serverModule], options: commandOptions },
            debug: { command: dotNetCommand, args: [serverModule, '--debug'], options: commandOptions }
        };
        return new vscode_languageclient_1.LanguageClient(PYTHON, languageClientName, serverOptions, clientOptions);
    }
    createSelfContainedLanguageClient(serverModule, clientOptions) {
        const options = { stdio: 'pipe' };
        const serverOptions = {
            run: { command: serverModule, rgs: [], options: options },
            debug: { command: serverModule, args: ['--debug'], options }
        };
        return new vscode_languageclient_1.LanguageClient(PYTHON, languageClientName, serverOptions, clientOptions);
    }
    // tslint:disable-next-line:member-ordering
    getAnalysisOptions() {
        return __awaiter(this, void 0, void 0, function* () {
            const properties = new Map();
            let interpreterData;
            let pythonPath = '';
            try {
                const interpreterDataService = new interpreterDataService_1.InterpreterDataService(this.context, this.services);
                interpreterData = yield interpreterDataService.getInterpreterData();
            }
            catch (ex) {
                this.appShell.showWarningMessage('Unable to determine path to the Python interpreter. IntelliSense will be limited.');
            }
            this.interpreterHash = interpreterData ? interpreterData.hash : '';
            if (interpreterData) {
                pythonPath = path.dirname(interpreterData.path);
                // tslint:disable-next-line:no-string-literal
                properties['InterpreterPath'] = interpreterData.path;
                // tslint:disable-next-line:no-string-literal
                properties['Version'] = interpreterData.version;
            }
            // tslint:disable-next-line:no-string-literal
            properties['DatabasePath'] = path.join(this.context.extensionPath, this.languageServerFolder);
            let searchPaths = interpreterData ? interpreterData.searchPaths.split(path.delimiter) : [];
            const settings = this.configuration.getSettings();
            if (settings.autoComplete) {
                const extraPaths = settings.autoComplete.extraPaths;
                if (extraPaths && extraPaths.length > 0) {
                    searchPaths.push(...extraPaths);
                }
            }
            const envVarsProvider = this.services.get(types_4.IEnvironmentVariablesProvider);
            const vars = yield envVarsProvider.getEnvironmentVariables();
            if (vars.PYTHONPATH && vars.PYTHONPATH.length > 0) {
                const pathUtils = this.services.get(types_3.IPathUtils);
                const paths = vars.PYTHONPATH.split(pathUtils.delimiter).filter(item => item.trim().length > 0);
                searchPaths.push(...paths);
            }
            // Make sure paths do not contain multiple slashes so file URIs
            // in VS Code (Node.js) and in the language server (.NET) match.
            // Note: for the language server paths separator is always ;
            searchPaths.push(pythonPath);
            searchPaths = searchPaths.map(p => path.normalize(p));
            const selector = [{ language: PYTHON, scheme: 'file' }];
            this.excludedFiles = this.getExcludedFiles();
            this.typeshedPaths = this.getTypeshedPaths(settings);
            // Options to control the language client
            return {
                // Register the server for Python documents
                documentSelector: selector,
                synchronize: {
                    configurationSection: PYTHON
                },
                outputChannel: this.output,
                initializationOptions: {
                    interpreter: {
                        properties
                    },
                    displayOptions: {
                        preferredFormat: 'markdown',
                        trimDocumentationLines: false,
                        maxDocumentationLineLength: 0,
                        trimDocumentationText: false,
                        maxDocumentationTextLength: 0
                    },
                    searchPaths,
                    typeStubSearchPaths: this.typeshedPaths,
                    excludeFiles: this.excludedFiles,
                    testEnvironment: constants_1.isTestExecution(),
                    analysisUpdates: true,
                    traceLogging: true,
                    asyncStartup: true
                },
                middleware: {
                    provideCompletionItem: (document, position, context, token, next) => {
                        if (this.surveyBanner) {
                            this.surveyBanner.showBanner().ignoreErrors();
                        }
                        return next(document, position, context, token);
                    }
                }
            };
        });
    }
    getExcludedFiles() {
        const list = ['**/Lib/**', '**/site-packages/**'];
        this.getVsCodeExcludeSection('search.exclude', list);
        this.getVsCodeExcludeSection('files.exclude', list);
        this.getVsCodeExcludeSection('files.watcherExclude', list);
        this.getPythonExcludeSection(list);
        return list;
    }
    getVsCodeExcludeSection(setting, list) {
        const states = this.workspace.getConfiguration(setting, this.root);
        if (states) {
            Object.keys(states)
                .filter(k => (k.indexOf('*') >= 0 || k.indexOf('/') >= 0) && states[k])
                .forEach(p => list.push(p));
        }
    }
    getPythonExcludeSection(list) {
        const pythonSettings = this.configuration.getSettings(this.root);
        const paths = pythonSettings && pythonSettings.linting ? pythonSettings.linting.ignorePatterns : undefined;
        if (paths && Array.isArray(paths)) {
            paths
                .filter(p => p && p.length > 0)
                .forEach(p => list.push(p));
        }
    }
    getTypeshedPaths(settings) {
        return settings.analysis.typeshedPaths && settings.analysis.typeshedPaths.length > 0
            ? settings.analysis.typeshedPaths
            : [path.join(this.context.extensionPath, this.languageServerFolder, 'Typeshed')];
    }
    onSettingsChanged() {
        return __awaiter(this, void 0, void 0, function* () {
            const ids = new interpreterDataService_1.InterpreterDataService(this.context, this.services);
            const idata = yield ids.getInterpreterData();
            if (!idata || idata.hash !== this.interpreterHash) {
                this.interpreterHash = idata ? idata.hash : '';
                yield this.restartLanguageServer();
                return;
            }
            const excludedFiles = this.getExcludedFiles();
            yield this.restartLanguageServerIfArrayChanged(this.excludedFiles, excludedFiles);
            const settings = this.configuration.getSettings();
            const typeshedPaths = this.getTypeshedPaths(settings);
            yield this.restartLanguageServerIfArrayChanged(this.typeshedPaths, typeshedPaths);
        });
    }
    restartLanguageServerIfArrayChanged(oldArray, newArray) {
        return __awaiter(this, void 0, void 0, function* () {
            if (newArray.length !== oldArray.length) {
                yield this.restartLanguageServer();
                return;
            }
            for (let i = 0; i < oldArray.length; i += 1) {
                if (oldArray[i] !== newArray[i]) {
                    yield this.restartLanguageServer();
                    return;
                }
            }
        });
    }
    restartLanguageServer() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.context) {
                return;
            }
            yield this.deactivate();
            yield this.activate();
        });
    }
};
LanguageServerExtensionActivator = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_5.IServiceContainer))
], LanguageServerExtensionActivator);
exports.LanguageServerExtensionActivator = LanguageServerExtensionActivator;
//# sourceMappingURL=languageServer.js.map