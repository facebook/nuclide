// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const codeCssGenerator_1 = require("./codeCssGenerator");
const datascience_1 = require("./datascience");
const codelensprovider_1 = require("./editor-integration/codelensprovider");
const history_1 = require("./history");
const historycommandlistener_1 = require("./historycommandlistener");
const historyProvider_1 = require("./historyProvider");
const jupyterExecution_1 = require("./jupyterExecution");
const jupyterImporter_1 = require("./jupyterImporter");
const jupyterProcess_1 = require("./jupyterProcess");
const jupyterServer_1 = require("./jupyterServer");
const statusProvider_1 = require("./statusProvider");
const types_1 = require("./types");
function registerTypes(serviceManager) {
    serviceManager.addSingleton(types_1.IDataScienceCodeLensProvider, codelensprovider_1.DataScienceCodeLensProvider);
    serviceManager.addSingleton(types_1.IDataScience, datascience_1.DataScience);
    serviceManager.addSingleton(types_1.IJupyterExecution, jupyterExecution_1.JupyterExecution);
    serviceManager.add(types_1.IDataScienceCommandListener, historycommandlistener_1.HistoryCommandListener);
    serviceManager.addSingleton(types_1.IHistoryProvider, historyProvider_1.HistoryProvider);
    serviceManager.add(types_1.IHistory, history_1.History);
    serviceManager.add(types_1.INotebookImporter, jupyterImporter_1.JupyterImporter);
    serviceManager.add(types_1.INotebookServer, jupyterServer_1.JupyterServer);
    serviceManager.add(types_1.INotebookProcess, jupyterProcess_1.JupyterProcess);
    serviceManager.addSingleton(types_1.ICodeCssGenerator, codeCssGenerator_1.CodeCssGenerator);
    serviceManager.addSingleton(types_1.IStatusProvider, statusProvider_1.StatusProvider);
}
exports.registerTypes = registerTypes;
//# sourceMappingURL=serviceRegistry.js.map