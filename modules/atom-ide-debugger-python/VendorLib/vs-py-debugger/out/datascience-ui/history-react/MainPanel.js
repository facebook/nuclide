// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
require("./mainPanel.css");
const lodash_1 = require("lodash");
const React = require("react");
const constants_1 = require("../../client/datascience/constants");
const types_1 = require("../../client/datascience/types");
const errorBoundary_1 = require("../react-common/errorBoundary");
const locReactSide_1 = require("../react-common/locReactSide");
const postOffice_1 = require("../react-common/postOffice");
const progress_1 = require("../react-common/progress");
const relativeImage_1 = require("../react-common/relativeImage");
const cell_1 = require("./cell");
const cellButton_1 = require("./cellButton");
const mainPanelState_1 = require("./mainPanelState");
const menuBar_1 = require("./menuBar");
class MainPanel extends React.Component {
    // tslint:disable-next-line:max-func-body-length
    constructor(props, state) {
        super(props);
        this.stackLimit = 10;
        // tslint:disable-next-line:no-any
        this.handleMessage = (msg, payload) => {
            switch (msg) {
                case constants_1.HistoryMessages.StartCell:
                    this.addCell(payload);
                    return true;
                case constants_1.HistoryMessages.FinishCell:
                    this.finishCell(payload);
                    return true;
                case constants_1.HistoryMessages.UpdateCell:
                    this.updateCell(payload);
                    return true;
                case constants_1.HistoryMessages.GetAllCells:
                    this.getAllCells();
                    return true;
                case constants_1.HistoryMessages.StartProgress:
                    if (!this.props.ignoreProgress) {
                        this.setState({ busy: true });
                    }
                    break;
                case constants_1.HistoryMessages.StopProgress:
                    if (!this.props.ignoreProgress) {
                        this.setState({ busy: false });
                    }
                    break;
                default:
                    break;
            }
            return false;
        };
        this.getAllCells = () => {
            // Send all of our cells back to the other side
            const cells = this.state.cellVMs.map((cellVM) => {
                return cellVM.cell;
            });
            postOffice_1.PostOffice.sendMessage({ type: constants_1.HistoryMessages.ReturnAllCells, payload: cells });
        };
        this.renderExtraButtons = () => {
            if (!this.props.skipDefault) {
                return React.createElement(cellButton_1.CellButton, { theme: this.props.theme, onClick: this.addMarkdown, tooltip: 'Add Markdown Test' }, "M");
            }
            return null;
        };
        this.renderCells = () => {
            return this.state.cellVMs.map((cellVM, index) => React.createElement(errorBoundary_1.ErrorBoundary, { key: index },
                React.createElement(cell_1.Cell, { cellVM: cellVM, theme: this.props.theme, gotoCode: () => this.gotoCellCode(index), delete: () => this.deleteCell(index) })));
        };
        this.addMarkdown = () => {
            this.addCell({
                data: {
                    cell_type: 'markdown',
                    metadata: {},
                    source: [
                        '## Cell 3\n',
                        'Here\'s some markdown\n',
                        '- A List\n',
                        '- Of Items'
                    ]
                },
                id: '1111',
                file: 'foo.py',
                line: 0,
                state: types_1.CellState.finished
            });
        };
        this.collapseAll = () => {
            postOffice_1.PostOffice.sendMessage({ type: constants_1.HistoryMessages.CollapseAll, payload: {} });
            const newCells = this.state.cellVMs.map((value) => {
                if (value.inputBlockOpen) {
                    return this.toggleCellVM(value);
                }
                else {
                    return Object.assign({}, value);
                }
            });
            // Now assign our new array copy to state
            this.setState({
                cellVMs: newCells,
                skipNextScroll: true
            });
        };
        this.expandAll = () => {
            postOffice_1.PostOffice.sendMessage({ type: constants_1.HistoryMessages.ExpandAll, payload: {} });
            const newCells = this.state.cellVMs.map((value) => {
                if (!value.inputBlockOpen) {
                    return this.toggleCellVM(value);
                }
                else {
                    return Object.assign({}, value);
                }
            });
            // Now assign our new array copy to state
            this.setState({
                cellVMs: newCells,
                skipNextScroll: true
            });
        };
        this.canCollapseAll = () => {
            return this.state.cellVMs.length > 0;
        };
        this.canExpandAll = () => {
            return this.state.cellVMs.length > 0;
        };
        this.canExport = () => {
            return this.state.cellVMs.length > 0;
        };
        this.canRedo = () => {
            return this.state.redoStack.length > 0;
        };
        this.canUndo = () => {
            return this.state.undoStack.length > 0;
        };
        this.pushStack = (stack, cells) => {
            // Get the undo stack up to the maximum length
            const slicedUndo = stack.slice(0, lodash_1.min([stack.length, this.stackLimit]));
            // Combine this with our set of cells
            return [...slicedUndo, cells];
        };
        this.gotoCellCode = (index) => {
            // Find our cell
            const cellVM = this.state.cellVMs[index];
            // Send a message to the other side to jump to a particular cell
            postOffice_1.PostOffice.sendMessage({ type: constants_1.HistoryMessages.GotoCodeCell, payload: { file: cellVM.cell.file, line: cellVM.cell.line } });
        };
        this.deleteCell = (index) => {
            postOffice_1.PostOffice.sendMessage({ type: constants_1.HistoryMessages.DeleteCell, payload: {} });
            // Update our state
            this.setState({
                cellVMs: this.state.cellVMs.filter((c, i) => {
                    return i !== index;
                }),
                undoStack: this.pushStack(this.state.undoStack, this.state.cellVMs),
                skipNextScroll: true
            });
        };
        this.clearAll = () => {
            postOffice_1.PostOffice.sendMessage({ type: constants_1.HistoryMessages.DeleteAllCells, payload: {} });
            // Update our state
            this.setState({
                cellVMs: [],
                undoStack: this.pushStack(this.state.undoStack, this.state.cellVMs),
                skipNextScroll: true,
                busy: false // No more progress on delete all
            });
        };
        this.redo = () => {
            // Pop one off of our redo stack and update our undo
            const cells = this.state.redoStack[this.state.redoStack.length - 1];
            const redoStack = this.state.redoStack.slice(0, this.state.redoStack.length - 1);
            const undoStack = this.pushStack(this.state.undoStack, this.state.cellVMs);
            postOffice_1.PostOffice.sendMessage({ type: constants_1.HistoryMessages.Redo, payload: {} });
            this.setState({
                cellVMs: cells,
                undoStack: undoStack,
                redoStack: redoStack,
                skipNextScroll: true
            });
        };
        this.undo = () => {
            // Pop one off of our undo stack and update our redo
            const cells = this.state.undoStack[this.state.undoStack.length - 1];
            const undoStack = this.state.undoStack.slice(0, this.state.undoStack.length - 1);
            const redoStack = this.pushStack(this.state.redoStack, this.state.cellVMs);
            postOffice_1.PostOffice.sendMessage({ type: constants_1.HistoryMessages.Undo, payload: {} });
            this.setState({
                cellVMs: cells,
                undoStack: undoStack,
                redoStack: redoStack,
                skipNextScroll: true
            });
        };
        this.restartKernel = () => {
            // Send a message to the other side to restart the kernel
            postOffice_1.PostOffice.sendMessage({ type: constants_1.HistoryMessages.RestartKernel, payload: {} });
        };
        this.export = () => {
            // Send a message to the other side to export our current list
            const cellContents = this.state.cellVMs.map((cellVM, index) => { return cellVM.cell; });
            postOffice_1.PostOffice.sendMessage({ type: constants_1.HistoryMessages.Export, payload: { contents: cellContents } });
        };
        this.scrollToBottom = () => {
            if (this.bottom && this.bottom.scrollIntoView && !this.state.skipNextScroll) {
                // Delay this until we are about to render. React hasn't setup the size of the bottom element
                // yet so we need to delay. 10ms looks good from a user point of view
                setTimeout(() => {
                    if (this.bottom) {
                        this.bottom.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'end' });
                    }
                }, 100);
            }
        };
        this.updateBottom = (newBottom) => {
            if (newBottom !== this.bottom) {
                this.bottom = newBottom;
            }
        };
        // tslint:disable-next-line:no-any
        this.addCell = (payload) => {
            if (payload) {
                const cell = payload;
                const cellVM = mainPanelState_1.createCellVM(cell, this.inputBlockToggled);
                if (cellVM) {
                    this.setState({
                        cellVMs: [...this.state.cellVMs, cellVM],
                        undoStack: this.pushStack(this.state.undoStack, this.state.cellVMs),
                        redoStack: this.state.redoStack,
                        skipNextScroll: false
                    });
                }
            }
        };
        this.inputBlockToggled = (id) => {
            // Create a shallow copy of the array, let not const as this is the shallow array copy that we will be changing
            const cellVMArray = [...this.state.cellVMs];
            const cellVMIndex = cellVMArray.findIndex((value) => {
                return value.cell.id === id;
            });
            if (cellVMIndex >= 0) {
                // Const here as this is the state object pulled off of our shallow array copy, we don't want to mutate it
                const targetCellVM = cellVMArray[cellVMIndex];
                // Mutate the shallow array copy
                cellVMArray[cellVMIndex] = this.toggleCellVM(targetCellVM);
                this.setState({
                    skipNextScroll: true,
                    cellVMs: cellVMArray
                });
            }
        };
        // Toggle the input collapse state of a cell view model return a shallow copy with updated values
        this.toggleCellVM = (cellVM) => {
            let newCollapseState = cellVM.inputBlockOpen;
            let newText = cellVM.inputBlockText;
            if (cellVM.cell.data.cell_type === 'code') {
                newCollapseState = !newCollapseState;
                newText = this.extractInputText(cellVM.cell);
                if (!newCollapseState) {
                    if (newText.length > 0) {
                        newText = newText.split('\n', 1)[0];
                        newText = newText.slice(0, 255); // Slice to limit length of string, slicing past the string length is fine
                        newText = newText.concat('...');
                    }
                }
            }
            return Object.assign({}, cellVM, { inputBlockOpen: newCollapseState, inputBlockText: newText });
        };
        this.extractInputText = (cell) => {
            return cell_1.Cell.concatMultilineString(cell.data.source);
        };
        this.updateOrAdd = (cell, allowAdd) => {
            const index = this.state.cellVMs.findIndex((c) => c.cell.id === cell.id);
            if (index >= 0) {
                // Update this cell
                this.state.cellVMs[index].cell = cell;
                this.forceUpdate();
            }
            else if (allowAdd) {
                // This is an entirely new cell (it may have started out as finished)
                this.addCell(cell);
            }
        };
        // tslint:disable-next-line:no-any
        this.finishCell = (payload) => {
            if (payload) {
                const cell = payload;
                if (cell) {
                    this.updateOrAdd(cell, true);
                }
            }
        };
        // tslint:disable-next-line:no-any
        this.updateCell = (payload) => {
            if (payload) {
                const cell = payload;
                if (cell) {
                    this.updateOrAdd(cell, false);
                }
            }
        };
        // Default state should show a busy message
        this.state = { cellVMs: [], busy: true, undoStack: [], redoStack: [] };
        if (!this.props.skipDefault) {
            this.state = mainPanelState_1.generateTestState(this.inputBlockToggled);
        }
    }
    componentDidMount() {
        this.scrollToBottom();
    }
    componentDidUpdate(prevProps, prevState) {
        this.scrollToBottom();
    }
    render() {
        const clearButtonImage = this.props.theme !== 'vscode-dark' ? './images/Cancel/Cancel_16xMD_vscode.svg' :
            './images/Cancel/Cancel_16xMD_vscode_dark.svg';
        const redoImage = this.props.theme !== 'vscode-dark' ? './images/Redo/Redo_16x_vscode.svg' :
            './images/Redo/Redo_16x_vscode_dark.svg';
        const undoImage = this.props.theme !== 'vscode-dark' ? './images/Undo/Undo_16x_vscode.svg' :
            './images/Undo/Undo_16x_vscode_dark.svg';
        const restartImage = this.props.theme !== 'vscode-dark' ? './images/Restart/Restart_grey_16x_vscode.svg' :
            './images/Restart/Restart_grey_16x_vscode_dark.svg';
        const saveAsImage = this.props.theme !== 'vscode-dark' ? './images/SaveAs/SaveAs_16x_vscode.svg' :
            './images/SaveAs/SaveAs_16x_vscode_dark.svg';
        const collapseAllImage = this.props.theme !== 'vscode-dark' ? './images/CollapseAll/CollapseAll_16x_vscode.svg' :
            './images/CollapseAll/CollapseAll_16x_vscode_dark.svg';
        const expandAllImage = this.props.theme !== 'vscode-dark' ? './images/ExpandAll/ExpandAll_16x_vscode.svg' :
            './images/ExpandAll/ExpandAll_16x_vscode_dark.svg';
        const progressBar = this.state.busy && !this.props.ignoreProgress ? React.createElement(progress_1.Progress, null) : undefined;
        return (React.createElement("div", { className: 'main-panel' },
            React.createElement(postOffice_1.PostOffice, { messageHandlers: [this] }),
            React.createElement(menuBar_1.MenuBar, { theme: this.props.theme, stylePosition: 'top-fixed' },
                this.renderExtraButtons(),
                React.createElement(cellButton_1.CellButton, { theme: this.props.theme, onClick: this.collapseAll, disabled: !this.canCollapseAll(), tooltip: locReactSide_1.getLocString('DataScience.collapseAll', 'Collapse all cell inputs') },
                    React.createElement(relativeImage_1.RelativeImage, { class: 'cell-button-image', path: collapseAllImage })),
                React.createElement(cellButton_1.CellButton, { theme: this.props.theme, onClick: this.expandAll, disabled: !this.canExpandAll(), tooltip: locReactSide_1.getLocString('DataScience.expandAll', 'Expand all cell inputs') },
                    React.createElement(relativeImage_1.RelativeImage, { class: 'cell-button-image', path: expandAllImage })),
                React.createElement(cellButton_1.CellButton, { theme: this.props.theme, onClick: this.export, disabled: !this.canExport(), tooltip: locReactSide_1.getLocString('DataScience.export', 'Export as Jupyter Notebook') },
                    React.createElement(relativeImage_1.RelativeImage, { class: 'cell-button-image', path: saveAsImage })),
                React.createElement(cellButton_1.CellButton, { theme: this.props.theme, onClick: this.restartKernel, tooltip: locReactSide_1.getLocString('DataScience.restartServer', 'Restart iPython Kernel') },
                    React.createElement(relativeImage_1.RelativeImage, { class: 'cell-button-image', path: restartImage })),
                React.createElement(cellButton_1.CellButton, { theme: this.props.theme, onClick: this.undo, disabled: !this.canUndo(), tooltip: locReactSide_1.getLocString('DataScience.undo', 'Undo') },
                    React.createElement(relativeImage_1.RelativeImage, { class: 'cell-button-image', path: undoImage })),
                React.createElement(cellButton_1.CellButton, { theme: this.props.theme, onClick: this.redo, disabled: !this.canRedo(), tooltip: locReactSide_1.getLocString('DataScience.redo', 'Redo') },
                    React.createElement(relativeImage_1.RelativeImage, { class: 'cell-button-image', path: redoImage })),
                React.createElement(cellButton_1.CellButton, { theme: this.props.theme, onClick: this.clearAll, tooltip: locReactSide_1.getLocString('DataScience.clearAll', 'Remove All Cells') },
                    React.createElement(relativeImage_1.RelativeImage, { class: 'cell-button-image', path: clearButtonImage }))),
            React.createElement("div", { className: 'top-spacing' }),
            progressBar,
            this.renderCells(),
            React.createElement("div", { ref: this.updateBottom })));
    }
}
exports.MainPanel = MainPanel;
//# sourceMappingURL=MainPanel.js.map