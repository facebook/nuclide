// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// Main interface
exports.IDataScience = Symbol('IDataScience');
exports.IDataScienceCommandListener = Symbol('IDataScienceCommandListener');
// Talks to a jupyter ipython kernel to retrieve data for cells
exports.INotebookServer = Symbol('INotebookServer');
exports.INotebookProcess = Symbol('INotebookProcess');
exports.IJupyterExecution = Symbol('IJupyterAvailablity');
exports.INotebookImporter = Symbol('INotebookImporter');
exports.IHistoryProvider = Symbol('IHistoryProvider');
exports.IHistory = Symbol('IHistory');
// Wraps the vscode API in order to send messages back and forth from a webview
exports.IPostOffice = Symbol('IPostOffice');
// Wraps the vscode CodeLensProvider base class
exports.IDataScienceCodeLensProvider = Symbol('IDataScienceCodeLensProvider');
// Wraps the Code Watcher API
exports.ICodeWatcher = Symbol('ICodeWatcher');
var CellState;
(function (CellState) {
    CellState[CellState["init"] = 0] = "init";
    CellState[CellState["executing"] = 1] = "executing";
    CellState[CellState["finished"] = 2] = "finished";
    CellState[CellState["error"] = 3] = "error";
})(CellState = exports.CellState || (exports.CellState = {}));
exports.ICodeCssGenerator = Symbol('ICodeCssGenerator');
exports.IStatusProvider = Symbol('IStatusProvider');
//# sourceMappingURL=types.js.map