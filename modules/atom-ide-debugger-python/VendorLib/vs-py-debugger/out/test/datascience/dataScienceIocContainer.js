// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const TypeMoq = require("typemoq");
const vscode_1 = require("vscode");
const types_1 = require("../../client/common/application/types");
const currentProcess_1 = require("../../client/common/process/currentProcess");
const types_2 = require("../../client/common/process/types");
const types_3 = require("../../client/common/types");
const codeCssGenerator_1 = require("../../client/datascience/codeCssGenerator");
const history_1 = require("../../client/datascience/history");
const historyProvider_1 = require("../../client/datascience/historyProvider");
const jupyterExecution_1 = require("../../client/datascience/jupyterExecution");
const jupyterImporter_1 = require("../../client/datascience/jupyterImporter");
const jupyterProcess_1 = require("../../client/datascience/jupyterProcess");
const jupyterServer_1 = require("../../client/datascience/jupyterServer");
const statusProvider_1 = require("../../client/datascience/statusProvider");
const types_4 = require("../../client/datascience/types");
const contracts_1 = require("../../client/interpreter/contracts");
const serviceRegistry_1 = require("../unittests/serviceRegistry");
const executionServiceMock_1 = require("./executionServiceMock");
class DataScienceIocContainer extends serviceRegistry_1.UnitTestIocContainer {
    constructor() {
        super();
    }
    registerDataScienceTypes() {
        this.registerFileSystemTypes();
        this.serviceManager.addSingleton(types_4.IJupyterExecution, jupyterExecution_1.JupyterExecution);
        this.serviceManager.addSingleton(types_4.IHistoryProvider, historyProvider_1.HistoryProvider);
        this.serviceManager.add(types_4.IHistory, history_1.History);
        this.serviceManager.add(types_4.INotebookImporter, jupyterImporter_1.JupyterImporter);
        this.serviceManager.add(types_4.INotebookServer, jupyterServer_1.JupyterServer);
        this.serviceManager.add(types_4.INotebookProcess, jupyterProcess_1.JupyterProcess);
        this.serviceManager.addSingleton(types_4.ICodeCssGenerator, codeCssGenerator_1.CodeCssGenerator);
        this.serviceManager.addSingleton(types_4.IStatusProvider, statusProvider_1.StatusProvider);
        // Also setup a mock execution service and interpreter service
        const logger = TypeMoq.Mock.ofType();
        const pythonExecutionService = new executionServiceMock_1.MockPythonExecutionService();
        const factory = TypeMoq.Mock.ofType();
        const interpreterService = TypeMoq.Mock.ofType();
        const condaService = TypeMoq.Mock.ofType();
        const appShell = TypeMoq.Mock.ofType();
        const documentManager = TypeMoq.Mock.ofType();
        const workspaceService = TypeMoq.Mock.ofType();
        const configurationService = TypeMoq.Mock.ofType();
        const currentProcess = new currentProcess_1.CurrentProcess();
        const pythonSettings = TypeMoq.Mock.ofType();
        const workspaceConfig = TypeMoq.Mock.ofType();
        this.serviceManager.addSingletonInstance(types_3.ILogger, logger.object);
        this.serviceManager.addSingletonInstance(types_2.IPythonExecutionFactory, factory.object);
        this.serviceManager.addSingletonInstance(contracts_1.IInterpreterService, interpreterService.object);
        this.serviceManager.addSingletonInstance(contracts_1.ICondaService, condaService.object);
        this.serviceManager.addSingletonInstance(types_1.IApplicationShell, appShell.object);
        this.serviceManager.addSingletonInstance(types_1.IDocumentManager, documentManager.object);
        this.serviceManager.addSingletonInstance(types_1.IWorkspaceService, workspaceService.object);
        this.serviceManager.addSingletonInstance(types_3.IConfigurationService, configurationService.object);
        this.serviceManager.addSingletonInstance(types_3.ICurrentProcess, currentProcess);
        const dummyDisposable = {
            dispose: () => { return; }
        };
        appShell.setup(a => a.showErrorMessage(TypeMoq.It.isAnyString())).returns(() => Promise.resolve(''));
        appShell.setup(a => a.showInformationMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(''));
        appShell.setup(a => a.showSaveDialog(TypeMoq.It.isAny())).returns(() => Promise.resolve(vscode_1.Uri.file('')));
        appShell.setup(a => a.setStatusBarMessage(TypeMoq.It.isAny())).returns(() => dummyDisposable);
        factory.setup(f => f.create(TypeMoq.It.isAny())).returns(() => Promise.resolve(pythonExecutionService));
        const e = new vscode_1.EventEmitter();
        interpreterService.setup(x => x.onDidChangeInterpreter).returns(() => e.event);
        configurationService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);
        workspaceService.setup(c => c.getConfiguration(TypeMoq.It.isAny())).returns(() => workspaceConfig.object);
        workspaceService.setup(c => c.getConfiguration(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => workspaceConfig.object);
        workspaceConfig.setup(c => c.get(TypeMoq.It.isAny())).returns(() => undefined);
        // tslint:disable-next-line:no-empty
        logger.setup(l => l.logInformation(TypeMoq.It.isAny())).returns((m) => { }); // console.log(m)); // REnable this to debug the server
    }
}
exports.DataScienceIocContainer = DataScienceIocContainer;
//# sourceMappingURL=dataScienceIocContainer.js.map