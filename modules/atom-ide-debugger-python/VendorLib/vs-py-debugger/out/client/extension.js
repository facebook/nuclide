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
// This line should always be right on top.
// tslint:disable-next-line:no-any
if (Reflect.metadata === undefined) {
    // tslint:disable-next-line:no-require-imports no-var-requires
    require('reflect-metadata');
}
const durations = {};
const stopWatch_1 = require("./common/utils/stopWatch");
// Do not move this linne of code (used to measure extension load times).
const stopWatch = new stopWatch_1.StopWatch();
const inversify_1 = require("inversify");
const vscode_1 = require("vscode");
const serviceRegistry_1 = require("./activation/serviceRegistry");
const types_1 = require("./activation/types");
const serviceRegistry_2 = require("./application/serviceRegistry");
const types_2 = require("./application/types");
const debugService_1 = require("./common/application/debugService");
const types_3 = require("./common/application/types");
const constants_1 = require("./common/constants");
const serviceRegistry_3 = require("./common/installer/serviceRegistry");
const serviceRegistry_4 = require("./common/platform/serviceRegistry");
const serviceRegistry_5 = require("./common/process/serviceRegistry");
const serviceRegistry_6 = require("./common/serviceRegistry");
const types_4 = require("./common/terminal/types");
const types_5 = require("./common/types");
const async_1 = require("./common/utils/async");
const serviceRegistry_7 = require("./common/variables/serviceRegistry");
const serviceRegistry_8 = require("./datascience/serviceRegistry");
const types_6 = require("./datascience/types");
const constants_2 = require("./debugger/constants");
const eventHandlerDispatcher_1 = require("./debugger/extension/hooks/eventHandlerDispatcher");
const types_7 = require("./debugger/extension/hooks/types");
const serviceRegistry_9 = require("./debugger/extension/serviceRegistry");
const types_8 = require("./debugger/extension/types");
const serviceRegistry_10 = require("./formatters/serviceRegistry");
const types_9 = require("./interpreter/configuration/types");
const contracts_1 = require("./interpreter/contracts");
const serviceRegistry_11 = require("./interpreter/serviceRegistry");
const container_1 = require("./ioc/container");
const serviceManager_1 = require("./ioc/serviceManager");
const types_10 = require("./ioc/types");
const linterCommands_1 = require("./linters/linterCommands");
const serviceRegistry_12 = require("./linters/serviceRegistry");
const types_11 = require("./linters/types");
const codeActionsProvider_1 = require("./providers/codeActionsProvider");
const formatProvider_1 = require("./providers/formatProvider");
const linterProvider_1 = require("./providers/linterProvider");
const replProvider_1 = require("./providers/replProvider");
const serviceRegistry_13 = require("./providers/serviceRegistry");
const simpleRefactorProvider_1 = require("./providers/simpleRefactorProvider");
const terminalProvider_1 = require("./providers/terminalProvider");
const types_12 = require("./providers/types");
const updateSparkLibraryProvider_1 = require("./providers/updateSparkLibraryProvider");
const telemetry_1 = require("./telemetry");
const constants_3 = require("./telemetry/constants");
const serviceRegistry_14 = require("./terminals/serviceRegistry");
const types_13 = require("./terminals/types");
const constants_4 = require("./unittests/common/constants");
const serviceRegistry_15 = require("./unittests/serviceRegistry");
durations.codeLoadingTime = stopWatch.elapsedTime;
const activationDeferred = async_1.createDeferred();
// tslint:disable-next-line:max-func-body-length
function activate(context) {
    return __awaiter(this, void 0, void 0, function* () {
        durations.startActivateTime = stopWatch.elapsedTime;
        const cont = new inversify_1.Container();
        const serviceManager = new serviceManager_1.ServiceManager(cont);
        const serviceContainer = new container_1.ServiceContainer(cont);
        registerServices(context, serviceManager, serviceContainer);
        initializeServices(context, serviceManager, serviceContainer);
        // When testing, do not perform health checks, as modal dialogs can be displayed.
        if (!constants_1.isTestExecution()) {
            const appDiagnostics = serviceContainer.get(types_2.IApplicationDiagnostics);
            yield appDiagnostics.performPreStartupHealthCheck();
        }
        const interpreterManager = serviceContainer.get(contracts_1.IInterpreterService);
        yield interpreterManager.autoSetInterpreter();
        serviceManager.get(types_13.ITerminalAutoActivation).register();
        const configuration = serviceManager.get(types_5.IConfigurationService);
        const pythonSettings = configuration.getSettings();
        const standardOutputChannel = serviceContainer.get(types_5.IOutputChannel, constants_1.STANDARD_OUTPUT_CHANNEL);
        simpleRefactorProvider_1.activateSimplePythonRefactorProvider(context, standardOutputChannel, serviceContainer);
        const activationService = serviceContainer.get(types_1.IExtensionActivationService);
        yield activationService.activate();
        const sortImports = serviceContainer.get(types_12.ISortImportsEditingProvider);
        sortImports.registerCommands();
        serviceManager.get(types_13.ICodeExecutionManager).registerCommands();
        sendStartupTelemetry(activationDeferred.promise, serviceContainer).ignoreErrors();
        const workspaceService = serviceContainer.get(types_3.IWorkspaceService);
        interpreterManager.refresh(workspaceService.hasWorkspaceFolders ? workspaceService.workspaceFolders[0].uri : undefined)
            .catch(ex => console.error('Python Extension: interpreterManager.refresh', ex));
        const jupyterExtension = vscode_1.extensions.getExtension('donjayamanne.jupyter');
        const lintingEngine = serviceManager.get(types_11.ILintingEngine);
        lintingEngine.linkJupyterExtension(jupyterExtension).ignoreErrors();
        // Activate data science features
        const dataScience = serviceManager.get(types_6.IDataScience);
        dataScience.activate().ignoreErrors();
        context.subscriptions.push(new linterCommands_1.LinterCommands(serviceManager));
        const linterProvider = new linterProvider_1.LinterProvider(context, serviceManager);
        context.subscriptions.push(linterProvider);
        // Enable indentAction
        // tslint:disable-next-line:no-non-null-assertion
        vscode_1.languages.setLanguageConfiguration(constants_1.PYTHON_LANGUAGE, {
            onEnterRules: [
                {
                    beforeText: /^\s*(?:def|class|for|if|elif|else|while|try|with|finally|except|async)\b.*:\s*/,
                    action: { indentAction: vscode_1.IndentAction.Indent }
                },
                {
                    beforeText: /^\s*#.*/,
                    afterText: /.+$/,
                    action: { indentAction: vscode_1.IndentAction.None, appendText: '# ' }
                },
                {
                    beforeText: /^\s+(continue|break|return)\b.*/,
                    afterText: /\s+$/,
                    action: { indentAction: vscode_1.IndentAction.Outdent }
                }
            ]
        });
        if (pythonSettings && pythonSettings.formatting && pythonSettings.formatting.provider !== 'none') {
            const formatProvider = new formatProvider_1.PythonFormattingEditProvider(context, serviceContainer);
            context.subscriptions.push(vscode_1.languages.registerDocumentFormattingEditProvider(constants_1.PYTHON, formatProvider));
            context.subscriptions.push(vscode_1.languages.registerDocumentRangeFormattingEditProvider(constants_1.PYTHON, formatProvider));
        }
        const deprecationMgr = serviceContainer.get(types_5.IFeatureDeprecationManager);
        deprecationMgr.initialize();
        context.subscriptions.push(deprecationMgr);
        context.subscriptions.push(updateSparkLibraryProvider_1.activateUpdateSparkLibraryProvider());
        context.subscriptions.push(new replProvider_1.ReplProvider(serviceContainer));
        context.subscriptions.push(new terminalProvider_1.TerminalProvider(serviceContainer));
        context.subscriptions.push(vscode_1.languages.registerCodeActionsProvider(constants_1.PYTHON, new codeActionsProvider_1.PythonCodeActionProvider(), { providedCodeActionKinds: [vscode_1.CodeActionKind.SourceOrganizeImports] }));
        serviceContainer.getAll(types_8.IDebugConfigurationProvider).forEach(debugConfig => {
            context.subscriptions.push(vscode_1.debug.registerDebugConfigurationProvider(constants_2.DebuggerTypeName, debugConfig));
        });
        serviceContainer.get(types_8.IDebuggerBanner).initialize();
        durations.endActivateTime = stopWatch.elapsedTime;
        activationDeferred.resolve();
        const api = { ready: activationDeferred.promise };
        // In test environment return the DI Container.
        if (constants_1.isTestExecution()) {
            // tslint:disable-next-line:no-any
            api.serviceContainer = serviceContainer;
        }
        return api;
    });
}
exports.activate = activate;
function registerServices(context, serviceManager, serviceContainer) {
    serviceManager.addSingletonInstance(types_10.IServiceContainer, serviceContainer);
    serviceManager.addSingletonInstance(types_10.IServiceManager, serviceManager);
    serviceManager.addSingletonInstance(types_5.IDisposableRegistry, context.subscriptions);
    serviceManager.addSingletonInstance(types_5.IMemento, context.globalState, types_5.GLOBAL_MEMENTO);
    serviceManager.addSingletonInstance(types_5.IMemento, context.workspaceState, types_5.WORKSPACE_MEMENTO);
    serviceManager.addSingletonInstance(types_5.IExtensionContext, context);
    const standardOutputChannel = vscode_1.window.createOutputChannel('Python');
    const unitTestOutChannel = vscode_1.window.createOutputChannel('Python Test Log');
    serviceManager.addSingletonInstance(types_5.IOutputChannel, standardOutputChannel, constants_1.STANDARD_OUTPUT_CHANNEL);
    serviceManager.addSingletonInstance(types_5.IOutputChannel, unitTestOutChannel, constants_4.TEST_OUTPUT_CHANNEL);
    serviceRegistry_1.registerTypes(serviceManager);
    serviceRegistry_6.registerTypes(serviceManager);
    serviceRegistry_5.registerTypes(serviceManager);
    serviceRegistry_7.registerTypes(serviceManager);
    serviceRegistry_15.registerTypes(serviceManager);
    serviceRegistry_12.registerTypes(serviceManager);
    serviceRegistry_11.registerTypes(serviceManager);
    serviceRegistry_10.registerTypes(serviceManager);
    serviceRegistry_4.registerTypes(serviceManager);
    serviceRegistry_3.registerTypes(serviceManager);
    serviceRegistry_14.registerTypes(serviceManager);
    serviceRegistry_8.registerTypes(serviceManager);
    serviceRegistry_9.registerTypes(serviceManager);
    serviceRegistry_2.registerTypes(serviceManager);
    serviceRegistry_13.registerTypes(serviceManager);
}
function initializeServices(context, serviceManager, serviceContainer) {
    const selector = serviceContainer.get(types_9.IInterpreterSelector);
    selector.initialize();
    context.subscriptions.push(selector);
    const interpreterManager = serviceContainer.get(contracts_1.IInterpreterService);
    interpreterManager.initialize();
    const handlers = serviceManager.getAll(types_7.IDebugSessionEventHandlers);
    const disposables = serviceManager.get(types_5.IDisposableRegistry);
    const dispatcher = new eventHandlerDispatcher_1.DebugSessionEventDispatcher(handlers, debugService_1.DebugService.instance, disposables);
    dispatcher.registerEventHandlers();
    // Display progress of interpreter refreshes only after extension has activated.
    serviceContainer.get(contracts_1.InterpreterLocatorProgressHandler).register();
    serviceContainer.get(contracts_1.IInterpreterLocatorProgressService).register();
    // Get latest interpreter list.
    const workspaceService = serviceContainer.get(types_3.IWorkspaceService);
    const mainWorkspaceUri = workspaceService.hasWorkspaceFolders ? workspaceService.workspaceFolders[0].uri : undefined;
    const interpreterService = serviceContainer.get(contracts_1.IInterpreterService);
    interpreterService.getInterpreters(mainWorkspaceUri).ignoreErrors();
}
function sendStartupTelemetry(activatedPromise, serviceContainer) {
    return __awaiter(this, void 0, void 0, function* () {
        const logger = serviceContainer.get(types_5.ILogger);
        try {
            yield activatedPromise;
            const terminalHelper = serviceContainer.get(types_4.ITerminalHelper);
            const terminalShellType = terminalHelper.identifyTerminalShell(terminalHelper.getTerminalShellPath());
            const condaLocator = serviceContainer.get(contracts_1.ICondaService);
            const interpreterService = serviceContainer.get(contracts_1.IInterpreterService);
            const workspaceService = serviceContainer.get(types_3.IWorkspaceService);
            const mainWorkspaceUri = workspaceService.hasWorkspaceFolders ? workspaceService.workspaceFolders[0].uri : undefined;
            const [condaVersion, interpreter, interpreters] = yield Promise.all([
                condaLocator.getCondaVersion().then(ver => ver ? ver.raw : '').catch(() => ''),
                interpreterService.getActiveInterpreter().catch(() => undefined),
                interpreterService.getInterpreters(mainWorkspaceUri).catch(() => [])
            ]);
            const workspaceFolderCount = workspaceService.hasWorkspaceFolders ? workspaceService.workspaceFolders.length : 0;
            const pythonVersion = interpreter ? interpreter.version_info.join('.') : undefined;
            const interpreterType = interpreter ? interpreter.type : undefined;
            const hasPython3 = interpreters
                .filter(item => item && Array.isArray(item.version_info) ? item.version_info[0] === 3 : false)
                .length > 0;
            const props = { condaVersion, terminal: terminalShellType, pythonVersion, interpreterType, workspaceFolderCount, hasPython3 };
            telemetry_1.sendTelemetryEvent(constants_3.EDITOR_LOAD, durations, props);
        }
        catch (ex) {
            logger.logError('sendStartupTelemetry failed.', ex);
        }
    });
}
//# sourceMappingURL=extension.js.map