// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
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
const vscode_1 = require("vscode");
const types_1 = require("../../common/application/types");
const contextKey_1 = require("../../common/contextKey");
const types_2 = require("../../common/types");
const localize = require("../../common/utils/localize");
const telemetry_1 = require("../../telemetry");
const constants_1 = require("../constants");
const types_3 = require("../types");
class CodeWatcher {
    constructor(serviceContainer, document) {
        this.version = -1;
        this.fileName = '';
        this.codeLenses = [];
        // tslint:disable-next-line:no-any
        this.handleError = (err) => {
            if (err.actionTitle !== undefined) {
                const jupyterError = err;
                // This is a special error that shows a link to open for more help
                this.applicationShell.showErrorMessage(jupyterError.message, jupyterError.actionTitle).then(v => {
                    // User clicked on the link, open it.
                    if (v === jupyterError.actionTitle) {
                        this.applicationShell.openUrl(jupyterError.action);
                    }
                });
            }
            else if (err.message) {
                this.applicationShell.showErrorMessage(err.message);
            }
            else {
                this.applicationShell.showErrorMessage(err.toString());
            }
            this.logger.logError(err);
        };
        this.historyProvider = serviceContainer.get(types_3.IHistoryProvider);
        this.commandManager = serviceContainer.get(types_1.ICommandManager);
        this.applicationShell = serviceContainer.get(types_1.IApplicationShell);
        this.logger = serviceContainer.get(types_2.ILogger);
        this.document = document;
        // Cache these, we don't want to pull an old version if the document is updated
        this.fileName = document.fileName;
        this.version = document.version;
        // Get document cells here
        const cells = this.getCells(document);
        this.codeLenses = [];
        cells.forEach(cell => {
            const cmd = {
                arguments: [this, cell.range],
                title: localize.DataScience.runCellLensCommandTitle(),
                command: constants_1.Commands.RunCell
            };
            this.codeLenses.push(new vscode_1.CodeLens(cell.range, cmd));
            const runAllCmd = {
                arguments: [this],
                title: localize.DataScience.runAllCellsLensCommandTitle(),
                command: constants_1.Commands.RunAllCells
            };
            this.codeLenses.push(new vscode_1.CodeLens(cell.range, runAllCmd));
        });
    }
    getFileName() {
        return this.fileName;
    }
    getVersion() {
        return this.version;
    }
    getCodeLenses() {
        return this.codeLenses;
    }
    runAllCells() {
        return __awaiter(this, void 0, void 0, function* () {
            const activeHistory = this.historyProvider.active;
            // Run all of our code lenses, they should always be ordered in the file so we can just
            // run them one by one
            for (const lens of this.codeLenses) {
                // Make sure that we have the correct command (RunCell) lenses
                if (lens.command && lens.command.command === constants_1.Commands.RunCell && lens.command.arguments && lens.command.arguments.length >= 2) {
                    const range = lens.command.arguments[1];
                    if (this.document && range) {
                        const code = this.document.getText(range);
                        yield activeHistory.addCode(code, this.getFileName(), range.start.line);
                    }
                }
            }
        });
    }
    runCell(range) {
        return __awaiter(this, void 0, void 0, function* () {
            const activeHistory = this.historyProvider.active;
            if (this.document) {
                const code = this.document.getText(range);
                try {
                    yield activeHistory.addCode(code, this.getFileName(), range.start.line, vscode_1.window.activeTextEditor);
                }
                catch (err) {
                    this.handleError(err);
                }
            }
        });
    }
    runCurrentCell() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!vscode_1.window.activeTextEditor || !vscode_1.window.activeTextEditor.document) {
                return;
            }
            for (const lens of this.codeLenses) {
                // Check to see which RunCell lens range overlaps the current selection start
                if (lens.range.contains(vscode_1.window.activeTextEditor.selection.start) && lens.command && lens.command.command === constants_1.Commands.RunCell) {
                    yield this.runCell(lens.range);
                    break;
                }
            }
        });
    }
    runCurrentCellAndAdvance() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!vscode_1.window.activeTextEditor || !vscode_1.window.activeTextEditor.document) {
                return;
            }
            let currentRunCellLens;
            let nextRunCellLens;
            for (const lens of this.codeLenses) {
                // If we have already found the current code lens, then the next run cell code lens will give us the next cell
                if (currentRunCellLens && lens.command && lens.command.command === constants_1.Commands.RunCell) {
                    nextRunCellLens = lens;
                    break;
                }
                // Check to see which RunCell lens range overlaps the current selection start
                if (lens.range.contains(vscode_1.window.activeTextEditor.selection.start) && lens.command && lens.command.command === constants_1.Commands.RunCell) {
                    currentRunCellLens = lens;
                }
            }
            if (currentRunCellLens) {
                // Either use the next cell that we found, or add a new one into the document
                let nextRange;
                if (!nextRunCellLens) {
                    nextRange = this.createNewCell(currentRunCellLens.range);
                }
                else {
                    nextRange = nextRunCellLens.range;
                }
                if (nextRange) {
                    this.advanceToRange(nextRange);
                }
                // Run the cell after moving the selection
                yield this.runCell(currentRunCellLens.range);
            }
        });
    }
    // User has picked run and advance on the last cell of a document
    // Create a new cell at the bottom and put their selection there, ready to type
    createNewCell(currentRange) {
        const editor = vscode_1.window.activeTextEditor;
        const newPosition = new vscode_1.Position(currentRange.end.line + 3, 0); // +3 to account for the added spaces and to position after the new mark
        if (editor) {
            editor.edit((editBuilder) => {
                editBuilder.insert(new vscode_1.Position(currentRange.end.line + 1, 0), '\n\n#%%\n');
            });
        }
        return new vscode_1.Range(newPosition, newPosition);
    }
    // Advance the cursor to the selected range
    advanceToRange(targetRange) {
        const editor = vscode_1.window.activeTextEditor;
        const newSelection = new vscode_1.Selection(targetRange.start, targetRange.start);
        if (editor) {
            editor.selection = newSelection;
            editor.revealRange(targetRange, vscode_1.TextEditorRevealType.Default);
        }
    }
    // Implmentation of getCells here based on Don's Jupyter extension work
    getCells(document) {
        const cellIdentifier = constants_1.RegExpValues.PythonCellMarker;
        const editorContext = new contextKey_1.ContextKey(constants_1.EditorContexts.HasCodeCells, this.commandManager);
        const cells = [];
        for (let index = 0; index < document.lineCount; index += 1) {
            const line = document.lineAt(index);
            // clear regex cache
            cellIdentifier.lastIndex = -1;
            if (cellIdentifier.test(line.text)) {
                const results = cellIdentifier.exec(line.text);
                if (cells.length > 0) {
                    const previousCell = cells[cells.length - 1];
                    previousCell.range = new vscode_1.Range(previousCell.range.start, document.lineAt(index - 1).range.end);
                }
                if (results !== null) {
                    cells.push({
                        range: line.range,
                        title: results.length > 1 ? results[2].trim() : ''
                    });
                }
            }
        }
        if (cells.length >= 1) {
            const line = document.lineAt(document.lineCount - 1);
            const previousCell = cells[cells.length - 1];
            previousCell.range = new vscode_1.Range(previousCell.range.start, line.range.end);
        }
        // Inform the editor context that we have cells, fire and forget is ok on the promise here
        // as we don't care to wait for this context to be set and we can't do anything if it fails
        editorContext.set(cells.length > 0).catch();
        return cells;
    }
}
__decorate([
    telemetry_1.captureTelemetry(constants_1.Telemetry.RunAllCells)
], CodeWatcher.prototype, "runAllCells", null);
__decorate([
    telemetry_1.captureTelemetry(constants_1.Telemetry.RunCell)
], CodeWatcher.prototype, "runCell", null);
__decorate([
    telemetry_1.captureTelemetry(constants_1.Telemetry.RunCurrentCell)
], CodeWatcher.prototype, "runCurrentCell", null);
__decorate([
    telemetry_1.captureTelemetry(constants_1.Telemetry.RunCurrentCellAndAdvance)
], CodeWatcher.prototype, "runCurrentCellAndAdvance", null);
exports.CodeWatcher = CodeWatcher;
//# sourceMappingURL=codewatcher.js.map