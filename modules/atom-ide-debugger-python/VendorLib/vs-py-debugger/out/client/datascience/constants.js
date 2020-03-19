// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var Commands;
(function (Commands) {
    Commands.RunAllCells = 'python.datascience.runallcells';
    Commands.RunCell = 'python.datascience.runcell';
    Commands.RunCurrentCell = 'python.datascience.runcurrentcell';
    Commands.RunCurrentCellAdvance = 'python.datascience.runcurrentcelladvance';
    Commands.ShowHistoryPane = 'python.datascience.showhistorypane';
    Commands.ImportNotebook = 'python.datascience.importnotebook';
})(Commands = exports.Commands || (exports.Commands = {}));
var EditorContexts;
(function (EditorContexts) {
    EditorContexts.HasCodeCells = 'python.datascience.hascodecells';
    EditorContexts.DataScienceEnabled = 'python.datascience.featureenabled';
})(EditorContexts = exports.EditorContexts || (exports.EditorContexts = {}));
var RegExpValues;
(function (RegExpValues) {
    RegExpValues.PythonCellMarker = new RegExp('^(#\\s*%%|#\\s*\\<codecell\\>|#\\s*In\\[\\d*?\\]|#\\s*In\\[ \\])(.*)');
    RegExpValues.PythonMarkdownCellMarker = /^#\s*%%\s*\[markdown\]/;
})(RegExpValues = exports.RegExpValues || (exports.RegExpValues = {}));
var HistoryMessages;
(function (HistoryMessages) {
    HistoryMessages.StartCell = 'start_cell';
    HistoryMessages.FinishCell = 'finish_cell';
    HistoryMessages.UpdateCell = 'update_cell';
    HistoryMessages.GotoCodeCell = 'gotocell_code';
    HistoryMessages.RestartKernel = 'restart_kernel';
    HistoryMessages.Export = 'export_to_ipynb';
    HistoryMessages.GetAllCells = 'get_all_cells';
    HistoryMessages.ReturnAllCells = 'return_all_cells';
    HistoryMessages.DeleteCell = 'delete_cell';
    HistoryMessages.DeleteAllCells = 'delete_all_cells';
    HistoryMessages.Undo = 'undo';
    HistoryMessages.Redo = 'redo';
    HistoryMessages.ExpandAll = 'expand_all';
    HistoryMessages.CollapseAll = 'collapse_all';
    HistoryMessages.StartProgress = 'start_progress';
    HistoryMessages.StopProgress = 'stop_progress';
})(HistoryMessages = exports.HistoryMessages || (exports.HistoryMessages = {}));
var Telemetry;
(function (Telemetry) {
    Telemetry.ImportNotebook = 'DATASCIENCE.IMPORT_NOTEBOOK';
    Telemetry.RunCell = 'DATASCIENCE.RUN_CELL';
    Telemetry.RunCurrentCell = 'DATASCIENCE.RUN_CURRENT_CELL';
    Telemetry.RunCurrentCellAndAdvance = 'DATASCIENCE.RUN_CURRENT_CELL_AND_ADVANCE';
    Telemetry.RunAllCells = 'DATASCIENCE.RUN_ALL_CELLS';
    Telemetry.DeleteAllCells = 'DATASCIENCE.DELETE_ALL_CELLS';
    Telemetry.DeleteCell = 'DATASCIENCE.DELETE_CELL';
    Telemetry.GotoSourceCode = 'DATASCIENCE.GOTO_SOURCE';
    Telemetry.RestartKernel = 'DATASCIENCE.RESTART_KERNEL';
    Telemetry.ExportNotebook = 'DATASCIENCE.EXPORT_NOTEBOOK';
    Telemetry.Undo = 'DATASCIENCE.UNDO';
    Telemetry.Redo = 'DATASCIENCE.REDO';
    Telemetry.ShowHistoryPane = 'DATASCIENCE.SHOW_HISTORY_PANE';
    Telemetry.ExpandAll = 'DATASCIENCE.EXPAND_ALL';
    Telemetry.CollapseAll = 'DATASCIENCE.COLLAPSE_ALL';
})(Telemetry = exports.Telemetry || (exports.Telemetry = {}));
var HelpLinks;
(function (HelpLinks) {
    HelpLinks.PythonInteractiveHelpLink = 'https://aka.ms/pyaiinstall';
})(HelpLinks = exports.HelpLinks || (exports.HelpLinks = {}));
//# sourceMappingURL=constants.js.map