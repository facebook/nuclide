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
require("../common/extensions");
const fs = require("fs-extra");
const inversify_1 = require("inversify");
const path = require("path");
const vscode_1 = require("vscode");
const types_1 = require("../common/application/types");
const constants_1 = require("../common/constants");
const types_2 = require("../common/types");
const localize = require("../common/utils/localize");
const contracts_1 = require("../interpreter/contracts");
const telemetry_1 = require("../telemetry");
const constants_2 = require("./constants");
const jupyterInstallError_1 = require("./jupyterInstallError");
const types_3 = require("./types");
let History = class History {
    constructor(applicationShell, documentManager, interpreterService, jupyterServer, provider, disposables, cssGenerator, statusProvider, jupyterExecution) {
        this.applicationShell = applicationShell;
        this.documentManager = documentManager;
        this.interpreterService = interpreterService;
        this.jupyterServer = jupyterServer;
        this.provider = provider;
        this.disposables = disposables;
        this.cssGenerator = cssGenerator;
        this.statusProvider = statusProvider;
        this.jupyterExecution = jupyterExecution;
        this.disposed = false;
        this.unfinishedCells = [];
        this.restartingKernel = false;
        this.potentiallyUnfinishedStatus = [];
        // tslint:disable-next-line: no-any no-empty
        this.onMessage = (message, payload) => {
            switch (message) {
                case constants_2.HistoryMessages.GotoCodeCell:
                    this.gotoCode(payload.file, payload.line);
                    break;
                case constants_2.HistoryMessages.RestartKernel:
                    this.restartKernel();
                    break;
                case constants_2.HistoryMessages.Export:
                    this.export(payload);
                    break;
                case constants_2.HistoryMessages.DeleteAllCells:
                    this.logTelemetry(constants_2.Telemetry.DeleteAllCells);
                    break;
                case constants_2.HistoryMessages.DeleteCell:
                    this.logTelemetry(constants_2.Telemetry.DeleteCell);
                    break;
                case constants_2.HistoryMessages.Undo:
                    this.logTelemetry(constants_2.Telemetry.Undo);
                    break;
                case constants_2.HistoryMessages.Redo:
                    this.logTelemetry(constants_2.Telemetry.Redo);
                    break;
                case constants_2.HistoryMessages.ExpandAll:
                    this.logTelemetry(constants_2.Telemetry.ExpandAll);
                    break;
                case constants_2.HistoryMessages.CollapseAll:
                    this.logTelemetry(constants_2.Telemetry.CollapseAll);
                    break;
                default:
                    break;
            }
        };
        this.setStatus = (message) => {
            const result = this.statusProvider.set(message, this);
            this.potentiallyUnfinishedStatus.push(result);
            return result;
        };
        this.logTelemetry = (event) => {
            telemetry_1.sendTelemetryEvent(event);
        };
        this.onAddCodeEvent = (cells, editor) => {
            // Send each cell to the other side
            cells.forEach((cell) => {
                if (this.webPanel) {
                    switch (cell.state) {
                        case types_3.CellState.init:
                            // Tell the react controls we have a new cell
                            this.webPanel.postMessage({ type: constants_2.HistoryMessages.StartCell, payload: cell });
                            // Keep track of this unfinished cell so if we restart we can finish right away.
                            this.unfinishedCells.push(cell);
                            break;
                        case types_3.CellState.executing:
                            // Tell the react controls we have an update
                            this.webPanel.postMessage({ type: constants_2.HistoryMessages.UpdateCell, payload: cell });
                            break;
                        case types_3.CellState.error:
                        case types_3.CellState.finished:
                            // Tell the react controls we're done
                            this.webPanel.postMessage({ type: constants_2.HistoryMessages.FinishCell, payload: cell });
                            // Remove from the list of unfinished cells
                            this.unfinishedCells = this.unfinishedCells.filter(c => c.id !== cell.id);
                            break;
                        default:
                            break; // might want to do a progress bar or something
                    }
                }
            });
            // If we have more than one cell, the second one should be a code cell. After it finishes, we need to inject a new cell entry
            if (cells.length > 1 && cells[1].state === types_3.CellState.finished) {
                // If we have an active editor, do the edit there so that the user can undo it, otherwise don't bother
                if (editor) {
                    editor.edit((editBuilder) => {
                        editBuilder.insert(new vscode_1.Position(cells[1].line, 0), '#%%\n');
                    });
                }
            }
        };
        this.onSettingsChanged = () => __awaiter(this, void 0, void 0, function* () {
            // Update our load promise. We need to restart the jupyter server
            if (this.loadPromise) {
                yield this.loadPromise;
                if (this.jupyterServer) {
                    yield this.jupyterServer.shutdown();
                }
            }
            this.loadPromise = this.loadJupyterServer();
        });
        this.exportToFile = (cells, file) => __awaiter(this, void 0, void 0, function* () {
            // Take the list of cells, convert them to a notebook json format and write to disk
            if (this.jupyterServer) {
                const notebook = yield this.jupyterServer.translateToNotebook(cells);
                try {
                    // tslint:disable-next-line: no-any
                    yield fs.writeFile(file, JSON.stringify(notebook), { encoding: 'utf8', flag: 'w' });
                    this.applicationShell.showInformationMessage(localize.DataScience.exportDialogComplete().format(file), localize.DataScience.exportOpenQuestion()).then((str) => {
                        if (str && file && this.jupyterServer) {
                            // If the user wants to, open the notebook they just generated.
                            this.jupyterServer.launchNotebook(file).ignoreErrors();
                        }
                    });
                }
                catch (exc) {
                    this.applicationShell.showInformationMessage(localize.DataScience.exportDialogFailed().format(exc));
                }
            }
        });
        this.loadJupyterServer = () => __awaiter(this, void 0, void 0, function* () {
            // Startup our jupyter server
            const status = this.setStatus(localize.DataScience.startingJupyter());
            try {
                yield this.jupyterServer.start();
            }
            catch (err) {
                throw err;
            }
            finally {
                if (status) {
                    status.dispose();
                }
            }
        });
        this.loadWebPanel = () => __awaiter(this, void 0, void 0, function* () {
            // Create our web panel (it's the UI that shows up for the history)
            // Figure out the name of our main bundle. Should be in our output directory
            const mainScriptPath = path.join(constants_1.EXTENSION_ROOT_DIR, 'out', 'datascience-ui', 'history-react', 'index_bundle.js');
            // Generate a css to put into the webpanel for viewing code
            const css = yield this.cssGenerator.generateThemeCss();
            // Use this script to create our web view panel. It should contain all of the necessary
            // script to communicate with this class.
            this.webPanel = this.provider.create(this, localize.DataScience.historyTitle(), mainScriptPath, css);
        });
        this.load = () => __awaiter(this, void 0, void 0, function* () {
            // Check to see if we support jupyter or not. If not quick fail
            if (!(yield this.jupyterExecution.isImportSupported())) {
                throw new jupyterInstallError_1.JupyterInstallError(localize.DataScience.jupyterNotSupported(), localize.DataScience.pythonInteractiveHelpLink());
            }
            // Otherwise wait for both
            yield Promise.all([this.loadJupyterServer(), this.loadWebPanel()]);
        });
        // Sign up for configuration changes
        this.settingsChangedDisposable = this.interpreterService.onDidChangeInterpreter(this.onSettingsChanged);
        // Create our event emitter
        this.closedEvent = new vscode_1.EventEmitter();
        this.disposables.push(this.closedEvent);
        // Load on a background thread.
        this.loadPromise = this.load();
    }
    show() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.disposed) {
                // Make sure we're loaded first
                yield this.loadPromise;
                // Then show our web panel.
                if (this.webPanel && this.jupyterServer) {
                    yield this.webPanel.show();
                }
            }
        });
    }
    get closed() {
        return this.closedEvent.event;
    }
    addCode(code, file, line, editor) {
        return __awaiter(this, void 0, void 0, function* () {
            // Start a status item
            const status = this.setStatus(localize.DataScience.executingCode());
            try {
                // Make sure we're loaded first.
                yield this.loadPromise;
                // Then show our webpanel
                yield this.show();
                if (this.jupyterServer) {
                    // Attempt to evaluate this cell in the jupyter notebook
                    const observable = this.jupyterServer.executeObservable(code, file, line);
                    // Sign up for cell changes
                    observable.subscribe((cells) => {
                        this.onAddCodeEvent(cells, editor);
                    }, (error) => {
                        status.dispose();
                        this.applicationShell.showErrorMessage(error);
                    }, () => {
                        // Indicate executing until this cell is done.
                        status.dispose();
                    });
                }
            }
            catch (err) {
                status.dispose();
                // We failed, dispose of ourselves too so that nobody uses us again
                this.dispose();
                throw err;
            }
        });
    }
    // tslint:disable-next-line: no-any no-empty
    postMessage(type, payload) {
        if (this.webPanel) {
            this.webPanel.postMessage({ type: type, payload: payload });
        }
    }
    dispose() {
        if (!this.disposed) {
            this.disposed = true;
            this.settingsChangedDisposable.dispose();
            if (this.jupyterServer) {
                this.jupyterServer.dispose();
            }
            this.closedEvent.fire(this);
        }
    }
    gotoCode(file, line) {
        this.gotoCodeInternal(file, line).catch(err => {
            this.applicationShell.showErrorMessage(err);
        });
    }
    gotoCodeInternal(file, line) {
        return __awaiter(this, void 0, void 0, function* () {
            let editor;
            if (yield fs.pathExists(file)) {
                editor = yield this.documentManager.showTextDocument(vscode_1.Uri.file(file), { viewColumn: vscode_1.ViewColumn.One });
            }
            else {
                // File URI isn't going to work. Look through the active text documents
                editor = this.documentManager.visibleTextEditors.find(te => te.document.fileName === file);
                if (editor) {
                    editor.show(vscode_1.ViewColumn.One);
                }
            }
            // If we found the editor change its selection
            if (editor) {
                editor.revealRange(new vscode_1.Range(line, 0, line, 0));
                editor.selection = new vscode_1.Selection(new vscode_1.Position(line, 0), new vscode_1.Position(line, 0));
            }
        });
    }
    restartKernel() {
        if (this.jupyterServer && !this.restartingKernel) {
            this.restartingKernel = true;
            // Ask the user if they want us to restart or not.
            const message = localize.DataScience.restartKernelMessage();
            const yes = localize.DataScience.restartKernelMessageYes();
            const no = localize.DataScience.restartKernelMessageNo();
            this.applicationShell.showInformationMessage(message, yes, no).then(v => {
                if (v === yes) {
                    // First we need to finish all outstanding cells.
                    this.unfinishedCells.forEach(c => {
                        c.state = types_3.CellState.error;
                        this.webPanel.postMessage({ type: constants_2.HistoryMessages.FinishCell, payload: c });
                    });
                    this.unfinishedCells = [];
                    this.potentiallyUnfinishedStatus.forEach(s => s.dispose());
                    this.potentiallyUnfinishedStatus = [];
                    // Set our status for the next 2 seconds.
                    this.statusProvider.set(localize.DataScience.restartingKernelStatus(), this, 2000);
                    // Then restart the kernel
                    this.jupyterServer.restartKernel().ignoreErrors();
                    this.restartingKernel = false;
                }
                else {
                    this.restartingKernel = false;
                }
            });
        }
    }
    export(payload) {
        if (payload.contents) {
            // Should be an array of cells
            const cells = payload.contents;
            if (cells && this.applicationShell) {
                const filtersKey = localize.DataScience.exportDialogFilter();
                const filtersObject = {};
                filtersObject[filtersKey] = ['ipynb'];
                // Bring up the open file dialog box
                this.applicationShell.showSaveDialog({
                    saveLabel: localize.DataScience.exportDialogTitle(),
                    filters: filtersObject
                }).then((uri) => __awaiter(this, void 0, void 0, function* () {
                    if (uri) {
                        yield this.exportToFile(cells, uri.fsPath);
                    }
                }));
            }
        }
    }
};
__decorate([
    telemetry_1.captureTelemetry(constants_2.Telemetry.GotoSourceCode, {}, false)
], History.prototype, "gotoCode", null);
__decorate([
    telemetry_1.captureTelemetry(constants_2.Telemetry.RestartKernel)
], History.prototype, "restartKernel", null);
__decorate([
    telemetry_1.captureTelemetry(constants_2.Telemetry.ExportNotebook, {}, false)
], History.prototype, "export", null);
History = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IApplicationShell)),
    __param(1, inversify_1.inject(types_1.IDocumentManager)),
    __param(2, inversify_1.inject(contracts_1.IInterpreterService)),
    __param(3, inversify_1.inject(types_3.INotebookServer)),
    __param(4, inversify_1.inject(types_1.IWebPanelProvider)),
    __param(5, inversify_1.inject(types_2.IDisposableRegistry)),
    __param(6, inversify_1.inject(types_3.ICodeCssGenerator)),
    __param(7, inversify_1.inject(types_3.IStatusProvider)),
    __param(8, inversify_1.inject(types_3.IJupyterExecution))
], History);
exports.History = History;
//# sourceMappingURL=history.js.map