// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
require("./cell.css");
const ansi_to_html_1 = require("ansi-to-html");
const React = require("react");
// tslint:disable-next-line:match-default-export-name import-name
const react_json_tree_1 = require("react-json-tree");
const types_1 = require("../../client/datascience/types");
const locReactSide_1 = require("../react-common/locReactSide");
const relativeImage_1 = require("../react-common/relativeImage");
const cellButton_1 = require("./cellButton");
const code_1 = require("./code");
const collapseButton_1 = require("./collapseButton");
const executionCount_1 = require("./executionCount");
const menuBar_1 = require("./menuBar");
const transforms_1 = require("./transforms");
class Cell extends React.Component {
    constructor(prop) {
        super(prop);
        // Public for testing
        this.getUnknownMimeTypeString = () => {
            return locReactSide_1.getLocString('DataScience.unknownMimeType', 'Unknown Mime Type');
        };
        this.toggleInputBlock = () => {
            const cellId = this.getCell().id;
            this.props.cellVM.inputBlockToggled(cellId);
        };
        this.getDeleteString = () => {
            return locReactSide_1.getLocString('DataScience.deleteButtonTooltip', 'Remove Cell');
        };
        this.getGoToCodeString = () => {
            return locReactSide_1.getLocString('DataScience.gotoCodeButtonTooltip', 'Go to code');
        };
        this.getCell = () => {
            return this.props.cellVM.cell;
        };
        this.isCodeCell = () => {
            return this.props.cellVM.cell.data.cell_type === 'code';
        };
        this.hasOutput = () => {
            return this.getCell().state === types_1.CellState.finished || this.getCell().state === types_1.CellState.error || this.getCell().state === types_1.CellState.executing;
        };
        this.getCodeCell = () => {
            return this.props.cellVM.cell.data;
        };
        this.getMarkdownCell = () => {
            return this.props.cellVM.cell.data;
        };
        this.renderInputs = () => {
            if (this.isCodeCell()) {
                // Colorize our text
                return (React.createElement("div", { className: 'cell-input' },
                    React.createElement(code_1.Code, { code: this.props.cellVM.inputBlockText, theme: this.props.theme })));
            }
            else {
                return null;
            }
        };
        this.renderResults = () => {
            const outputClassNames = this.isCodeCell() ?
                `cell-output cell-output-${this.props.theme}` :
                '';
            // Results depend upon the type of cell
            const results = this.isCodeCell() ?
                this.renderCodeOutputs() :
                this.renderMarkdown(this.getMarkdownCell());
            // Then combine them inside a div
            return React.createElement("div", { className: outputClassNames }, results);
        };
        this.renderCodeOutputs = () => {
            if (this.isCodeCell() && this.hasOutput()) {
                // Render the outputs
                return this.getCodeCell().outputs.map((output, index) => {
                    return this.renderOutput(output, index);
                });
            }
        };
        this.renderMarkdown = (markdown) => {
            // React-markdown expects that the source is a string
            const source = Cell.concatMultilineString(markdown.source);
            const Transform = transforms_1.transforms['text/markdown'];
            return React.createElement(Transform, { data: source });
        };
        this.renderWithTransform = (mimetype, output, index) => {
            // If we found a mimetype, use the transform
            if (mimetype) {
                // Get the matching React.Component for that mimetype
                const Transform = transforms_1.transforms[mimetype];
                if (typeof mimetype !== 'string') {
                    return React.createElement("div", { key: index }, this.getUnknownMimeTypeString());
                }
                try {
                    // Text/plain has to be massaged. It expects a continuous string
                    if (output.data) {
                        let data = output.data[mimetype];
                        if (mimetype === 'text/plain') {
                            data = Cell.concatMultilineString(data);
                        }
                        // Return the transformed control using the data we massaged
                        return React.createElement(Transform, { key: index, data: data });
                    }
                }
                catch (ex) {
                    window.console.log('Error in rendering');
                    window.console.log(ex);
                    return React.createElement("div", null);
                }
            }
            return React.createElement("div", null);
        };
        this.renderOutput = (output, index) => {
            // Borrowed this from Don's Jupyter extension
            // First make sure we have the mime data
            if (!output) {
                return React.createElement("div", { key: index });
            }
            // Make a copy of our data so we don't modify our cell
            const copy = Object.assign({}, output);
            // Special case for json
            if (copy.data && copy.data['application/json']) {
                return React.createElement(react_json_tree_1.default, { key: index, data: copy.data });
            }
            // Stream and error output need to be converted
            if (copy.output_type === 'stream') {
                const stream = copy;
                const text = Cell.concatMultilineString(stream.text);
                copy.data = {
                    'text/html': text
                };
            }
            else if (copy.output_type === 'error') {
                const error = copy;
                try {
                    const converter = new ansi_to_html_1.default();
                    const trace = converter.toHtml(error.traceback.join('\n'));
                    copy.data = {
                        'text/html': trace
                    };
                }
                catch (_a) {
                    // This can fail during unit tests, just use the raw data
                    copy.data = {
                        'text/html': error.evalue
                    };
                }
            }
            // Jupyter style MIME bundle
            // Find out which mimetype is the richest
            const mimetype = transforms_1.richestMimetype(copy.data, transforms_1.displayOrder, transforms_1.transforms);
            // If that worked, use the transform
            if (mimetype) {
                return this.renderWithTransform(mimetype, copy, index);
            }
            const str = this.getUnknownMimeTypeString();
            return React.createElement("div", { key: index },
                "$",
                str);
        };
    }
    static concatMultilineString(str) {
        if (Array.isArray(str)) {
            let result = '';
            for (let i = 0; i < str.length; i += 1) {
                const s = str[i];
                if (i < str.length - 1 && !s.endsWith('\n')) {
                    result = result.concat(`${s}\n`);
                }
                else {
                    result = result.concat(s);
                }
            }
            return result.trim();
        }
        return str.toString().trim();
    }
    render() {
        const clearButtonImage = this.props.theme !== 'vscode-dark' ? './images/Cancel/Cancel_16xMD_vscode.svg' :
            './images/Cancel/Cancel_16xMD_vscode_dark.svg';
        const gotoSourceImage = this.props.theme !== 'vscode-dark' ? './images/GoToSourceCode/GoToSourceCode_16x_vscode.svg' :
            './images/GoToSourceCode/GoToSourceCode_16x_vscode_dark.svg';
        return (React.createElement("div", { className: 'cell-wrapper' },
            React.createElement(menuBar_1.MenuBar, { theme: this.props.theme },
                React.createElement(cellButton_1.CellButton, { theme: this.props.theme, onClick: this.props.delete, tooltip: this.getDeleteString() },
                    React.createElement(relativeImage_1.RelativeImage, { class: 'cell-button-image', path: clearButtonImage })),
                React.createElement(cellButton_1.CellButton, { theme: this.props.theme, onClick: this.props.gotoCode, tooltip: this.getGoToCodeString() },
                    React.createElement(relativeImage_1.RelativeImage, { class: 'cell-button-image', path: gotoSourceImage }))),
            React.createElement("div", { className: 'cell-outer' },
                React.createElement("div", { className: 'controls-div' },
                    React.createElement("div", { className: 'controls-flex' },
                        React.createElement(executionCount_1.ExecutionCount, { cell: this.props.cellVM.cell, theme: this.props.theme, visible: this.isCodeCell() }),
                        React.createElement(collapseButton_1.CollapseButton, { theme: this.props.theme, hidden: this.props.cellVM.inputBlockCollapseNeeded, open: this.props.cellVM.inputBlockOpen, onClick: this.toggleInputBlock, tooltip: locReactSide_1.getLocString('DataScience.collapseInputTooltip', 'Collapse input block') }))),
                React.createElement("div", { className: 'content-div' },
                    React.createElement("div", { className: 'cell-result-container' },
                        this.renderInputs(),
                        this.renderResults())))));
    }
}
exports.Cell = Cell;
//# sourceMappingURL=cell.js.map