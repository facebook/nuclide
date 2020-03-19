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
// tslint:disable:no-duplicate-imports no-unnecessary-callback-wrapper
const inversify_1 = require("inversify");
const vscode = require("vscode");
const types_1 = require("../common/application/types");
const constants = require("../common/constants");
const types_2 = require("../common/types");
const types_3 = require("../ioc/types");
const constants_1 = require("../telemetry/constants");
const index_1 = require("../telemetry/index");
const main_1 = require("./codeLenses/main");
const constants_2 = require("./common/constants");
const testUtils_1 = require("./common/testUtils");
const types_4 = require("./common/types");
const types_5 = require("./types");
let UnitTestManagementService = class UnitTestManagementService {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
        this.onDidChange = new vscode.EventEmitter();
        this.disposableRegistry = serviceContainer.get(types_2.IDisposableRegistry);
        this.outputChannel = serviceContainer.get(types_2.IOutputChannel, constants_2.TEST_OUTPUT_CHANNEL);
        this.workspaceService = serviceContainer.get(types_1.IWorkspaceService);
        this.documentManager = serviceContainer.get(types_1.IDocumentManager);
        this.disposableRegistry.push(this);
    }
    dispose() {
        if (this.workspaceTestManagerService) {
            this.workspaceTestManagerService.dispose();
        }
    }
    activate() {
        return __awaiter(this, void 0, void 0, function* () {
            this.workspaceTestManagerService = this.serviceContainer.get(types_4.IWorkspaceTestManagerService);
            this.registerHandlers();
            this.registerCommands();
            this.autoDiscoverTests()
                .catch(ex => this.serviceContainer.get(types_2.ILogger).logError('Failed to auto discover tests upon activation', ex));
        });
    }
    activateCodeLenses(symboldProvider) {
        return __awaiter(this, void 0, void 0, function* () {
            const testCollectionStorage = this.serviceContainer.get(types_4.ITestCollectionStorageService);
            this.disposableRegistry.push(main_1.activateCodeLenses(this.onDidChange, symboldProvider, testCollectionStorage));
        });
    }
    getTestManager(displayTestNotConfiguredMessage, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            let wkspace;
            if (resource) {
                const wkspaceFolder = this.workspaceService.getWorkspaceFolder(resource);
                wkspace = wkspaceFolder ? wkspaceFolder.uri : undefined;
            }
            else {
                wkspace = yield testUtils_1.selectTestWorkspace();
            }
            if (!wkspace) {
                return;
            }
            const testManager = this.workspaceTestManagerService.getTestManager(wkspace);
            if (testManager) {
                return testManager;
            }
            if (displayTestNotConfiguredMessage) {
                const configurationService = this.serviceContainer.get(types_5.IUnitTestConfigurationService);
                yield configurationService.displayTestFrameworkError(wkspace);
            }
        });
    }
    configurationChangeHandler(e) {
        return __awaiter(this, void 0, void 0, function* () {
            // If there's one workspace, then stop the tests and restart,
            // else let the user do this manually.
            if (!this.workspaceService.hasWorkspaceFolders || this.workspaceService.workspaceFolders.length > 1) {
                return;
            }
            const workspaceUri = this.workspaceService.workspaceFolders[0].uri;
            if (!e.affectsConfiguration('python.unitTest', workspaceUri)) {
                return;
            }
            const settings = this.serviceContainer.get(types_2.IConfigurationService).getSettings(workspaceUri);
            if (!settings.unitTest.nosetestsEnabled && !settings.unitTest.pyTestEnabled && !settings.unitTest.unittestEnabled) {
                if (this.testResultDisplay) {
                    this.testResultDisplay.enabled = false;
                }
                // tslint:disable-next-line:no-suspicious-comment
                // TODO: Why are we disposing, what happens when tests are enabled.
                if (this.workspaceTestManagerService) {
                    this.workspaceTestManagerService.dispose();
                }
                return;
            }
            if (this.testResultDisplay) {
                this.testResultDisplay.enabled = true;
            }
            this.autoDiscoverTests()
                .catch(ex => this.serviceContainer.get(types_2.ILogger).logError('Failed to auto discover tests upon activation', ex));
        });
    }
    discoverTestsForDocument(doc) {
        return __awaiter(this, void 0, void 0, function* () {
            const testManager = yield this.getTestManager(false, doc.uri);
            if (!testManager) {
                return;
            }
            const tests = yield testManager.discoverTests(constants_2.CommandSource.auto, false, true);
            if (!tests || !Array.isArray(tests.testFiles) || tests.testFiles.length === 0) {
                return;
            }
            if (tests.testFiles.findIndex((f) => f.fullPath === doc.uri.fsPath) === -1) {
                return;
            }
            if (this.autoDiscoverTimer) {
                clearTimeout(this.autoDiscoverTimer);
            }
            this.autoDiscoverTimer = setTimeout(() => this.discoverTests(constants_2.CommandSource.auto, doc.uri, true, false, true), 1000);
        });
    }
    autoDiscoverTests() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.workspaceService.hasWorkspaceFolders) {
                return;
            }
            const configurationService = this.serviceContainer.get(types_2.IConfigurationService);
            const settings = configurationService.getSettings();
            if (!settings.unitTest.nosetestsEnabled && !settings.unitTest.pyTestEnabled && !settings.unitTest.unittestEnabled) {
                return;
            }
            // No need to display errors.
            // tslint:disable-next-line:no-empty
            this.discoverTests(constants_2.CommandSource.auto, this.workspaceService.workspaceFolders[0].uri, true).catch(() => { });
        });
    }
    discoverTests(cmdSource, resource, ignoreCache, userInitiated, quietMode) {
        return __awaiter(this, void 0, void 0, function* () {
            const testManager = yield this.getTestManager(true, resource);
            if (!testManager) {
                return;
            }
            if (testManager.status === types_4.TestStatus.Discovering || testManager.status === types_4.TestStatus.Running) {
                return;
            }
            if (!this.testResultDisplay) {
                this.testResultDisplay = this.serviceContainer.get(types_5.ITestResultDisplay);
                this.testResultDisplay.onDidChange(() => this.onDidChange.fire());
            }
            const discoveryPromise = testManager.discoverTests(cmdSource, ignoreCache, quietMode, userInitiated);
            this.testResultDisplay.displayDiscoverStatus(discoveryPromise, quietMode)
                .catch(ex => console.error('Python Extension: displayDiscoverStatus', ex));
            yield discoveryPromise;
        });
    }
    stopTests(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            index_1.sendTelemetryEvent(constants_1.UNITTEST_STOP);
            const testManager = yield this.getTestManager(true, resource);
            if (testManager) {
                testManager.stop();
            }
        });
    }
    displayStopUI(message) {
        return __awaiter(this, void 0, void 0, function* () {
            const testManager = yield this.getTestManager(true);
            if (!testManager) {
                return;
            }
            const testDisplay = this.serviceContainer.get(types_5.ITestDisplay);
            testDisplay.displayStopTestUI(testManager.workspaceFolder, message);
        });
    }
    displayUI(cmdSource) {
        return __awaiter(this, void 0, void 0, function* () {
            const testManager = yield this.getTestManager(true);
            if (!testManager) {
                return;
            }
            const testDisplay = this.serviceContainer.get(types_5.ITestDisplay);
            testDisplay.displayTestUI(cmdSource, testManager.workspaceFolder);
        });
    }
    displayPickerUI(cmdSource, file, testFunctions, debug) {
        return __awaiter(this, void 0, void 0, function* () {
            const testManager = yield this.getTestManager(true, file);
            if (!testManager) {
                return;
            }
            const testDisplay = this.serviceContainer.get(types_5.ITestDisplay);
            testDisplay.displayFunctionTestPickerUI(cmdSource, testManager.workspaceFolder, testManager.workingDirectory, file, testFunctions, debug);
        });
    }
    viewOutput(cmdSource) {
        index_1.sendTelemetryEvent(constants_1.UNITTEST_VIEW_OUTPUT);
        this.outputChannel.show();
    }
    selectAndRunTestMethod(cmdSource, resource, debug) {
        return __awaiter(this, void 0, void 0, function* () {
            const testManager = yield this.getTestManager(true, resource);
            if (!testManager) {
                return;
            }
            try {
                yield testManager.discoverTests(cmdSource, true, true, true);
            }
            catch (ex) {
                return;
            }
            const testCollectionStorage = this.serviceContainer.get(types_4.ITestCollectionStorageService);
            const tests = testCollectionStorage.getTests(testManager.workspaceFolder);
            const testDisplay = this.serviceContainer.get(types_5.ITestDisplay);
            const selectedTestFn = yield testDisplay.selectTestFunction(testManager.workspaceFolder.fsPath, tests);
            if (!selectedTestFn) {
                return;
            }
            // tslint:disable-next-line:prefer-type-cast no-object-literal-type-assertion
            yield this.runTestsImpl(cmdSource, testManager.workspaceFolder, { testFunction: [selectedTestFn.testFunction] }, false, debug);
        });
    }
    selectAndRunTestFile(cmdSource) {
        return __awaiter(this, void 0, void 0, function* () {
            const testManager = yield this.getTestManager(true);
            if (!testManager) {
                return;
            }
            try {
                yield testManager.discoverTests(cmdSource, true, true, true);
            }
            catch (ex) {
                return;
            }
            const testCollectionStorage = this.serviceContainer.get(types_4.ITestCollectionStorageService);
            const tests = testCollectionStorage.getTests(testManager.workspaceFolder);
            const testDisplay = this.serviceContainer.get(types_5.ITestDisplay);
            const selectedFile = yield testDisplay.selectTestFile(testManager.workspaceFolder.fsPath, tests);
            if (!selectedFile) {
                return;
            }
            yield this.runTestsImpl(cmdSource, testManager.workspaceFolder, { testFile: [selectedFile] });
        });
    }
    runCurrentTestFile(cmdSource) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.documentManager.activeTextEditor) {
                return;
            }
            const testManager = yield this.getTestManager(true, this.documentManager.activeTextEditor.document.uri);
            if (!testManager) {
                return;
            }
            try {
                yield testManager.discoverTests(cmdSource, true, true, true);
            }
            catch (ex) {
                return;
            }
            const testCollectionStorage = this.serviceContainer.get(types_4.ITestCollectionStorageService);
            const tests = testCollectionStorage.getTests(testManager.workspaceFolder);
            const testFiles = tests.testFiles.filter(testFile => {
                return testFile.fullPath === this.documentManager.activeTextEditor.document.uri.fsPath;
            });
            if (testFiles.length < 1) {
                return;
            }
            yield this.runTestsImpl(cmdSource, testManager.workspaceFolder, { testFile: [testFiles[0]] });
        });
    }
    runTestsImpl(cmdSource, resource, testsToRun, runFailedTests, debug = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const testManager = yield this.getTestManager(true, resource);
            if (!testManager) {
                return;
            }
            if (!this.testResultDisplay) {
                this.testResultDisplay = this.serviceContainer.get(types_5.ITestResultDisplay);
                this.testResultDisplay.onDidChange(() => this.onDidChange.fire());
            }
            const promise = testManager.runTest(cmdSource, testsToRun, runFailedTests, debug)
                .catch(reason => {
                if (reason !== constants_2.CANCELLATION_REASON) {
                    this.outputChannel.appendLine(`Error: ${reason}`);
                }
                return Promise.reject(reason);
            });
            this.testResultDisplay.displayProgressStatus(promise, debug);
            yield promise;
        });
    }
    registerCommands() {
        const disposablesRegistry = this.serviceContainer.get(types_2.IDisposableRegistry);
        const commandManager = this.serviceContainer.get(types_1.ICommandManager);
        const disposables = [
            commandManager.registerCommand(constants.Commands.Tests_Discover, (_, cmdSource = constants_2.CommandSource.commandPalette, resource) => {
                // Ignore the exceptions returned.
                // This command will be invoked from other places of the extension.
                this.discoverTests(cmdSource, resource, true, true).ignoreErrors();
            }),
            commandManager.registerCommand(constants.Commands.Tests_Run_Failed, (_, cmdSource = constants_2.CommandSource.commandPalette, resource) => this.runTestsImpl(cmdSource, resource, undefined, true)),
            commandManager.registerCommand(constants.Commands.Tests_Run, (_, cmdSource = constants_2.CommandSource.commandPalette, file, testToRun) => this.runTestsImpl(cmdSource, file, testToRun)),
            commandManager.registerCommand(constants.Commands.Tests_Debug, (_, cmdSource = constants_2.CommandSource.commandPalette, file, testToRun) => this.runTestsImpl(cmdSource, file, testToRun, false, true)),
            commandManager.registerCommand(constants.Commands.Tests_View_UI, () => this.displayUI(constants_2.CommandSource.commandPalette)),
            commandManager.registerCommand(constants.Commands.Tests_Picker_UI, (_, cmdSource = constants_2.CommandSource.commandPalette, file, testFunctions) => this.displayPickerUI(cmdSource, file, testFunctions)),
            commandManager.registerCommand(constants.Commands.Tests_Picker_UI_Debug, (_, cmdSource = constants_2.CommandSource.commandPalette, file, testFunctions) => this.displayPickerUI(cmdSource, file, testFunctions, true)),
            commandManager.registerCommand(constants.Commands.Tests_Stop, (_, resource) => this.stopTests(resource)),
            commandManager.registerCommand(constants.Commands.Tests_ViewOutput, (_, cmdSource = constants_2.CommandSource.commandPalette) => this.viewOutput(cmdSource)),
            commandManager.registerCommand(constants.Commands.Tests_Ask_To_Stop_Discovery, () => this.displayStopUI('Stop discovering tests')),
            commandManager.registerCommand(constants.Commands.Tests_Ask_To_Stop_Test, () => this.displayStopUI('Stop running tests')),
            commandManager.registerCommand(constants.Commands.Tests_Select_And_Run_Method, (_, cmdSource = constants_2.CommandSource.commandPalette, resource) => this.selectAndRunTestMethod(cmdSource, resource)),
            commandManager.registerCommand(constants.Commands.Tests_Select_And_Debug_Method, (_, cmdSource = constants_2.CommandSource.commandPalette, resource) => this.selectAndRunTestMethod(cmdSource, resource, true)),
            commandManager.registerCommand(constants.Commands.Tests_Select_And_Run_File, (_, cmdSource = constants_2.CommandSource.commandPalette) => this.selectAndRunTestFile(cmdSource)),
            commandManager.registerCommand(constants.Commands.Tests_Run_Current_File, (_, cmdSource = constants_2.CommandSource.commandPalette) => this.runCurrentTestFile(cmdSource))
        ];
        disposablesRegistry.push(...disposables);
    }
    onDocumentSaved(doc) {
        const settings = this.serviceContainer.get(types_2.IConfigurationService).getSettings(doc.uri);
        if (!settings.unitTest.autoTestDiscoverOnSaveEnabled) {
            return;
        }
        this.discoverTestsForDocument(doc).ignoreErrors();
    }
    registerHandlers() {
        const documentManager = this.serviceContainer.get(types_1.IDocumentManager);
        this.disposableRegistry.push(documentManager.onDidSaveTextDocument(this.onDocumentSaved.bind(this)));
        this.disposableRegistry.push(this.workspaceService.onDidChangeConfiguration(e => {
            if (this.configChangedTimer) {
                clearTimeout(this.configChangedTimer);
            }
            this.configChangedTimer = setTimeout(() => this.configurationChangeHandler(e), 1000);
        }));
    }
};
UnitTestManagementService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_3.IServiceContainer))
], UnitTestManagementService);
exports.UnitTestManagementService = UnitTestManagementService;
//# sourceMappingURL=main.js.map