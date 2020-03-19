// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const React = require("react");
require("./cellButton.css");
class CellButton extends React.Component {
    constructor(props) {
        super(props);
    }
    render() {
        const classNames = `cell-button cell-button-${this.props.theme}`;
        const innerFilter = this.props.disabled ? 'cell-button-inner-disabled-filter' : '';
        return (React.createElement("button", { role: 'button', "aria-pressed": 'false', disabled: this.props.disabled, title: this.props.tooltip, className: classNames, onClick: this.props.onClick },
            React.createElement("div", { className: innerFilter },
                React.createElement("div", { className: 'cell-button-child' }, this.props.children))));
    }
}
exports.CellButton = CellButton;
//# sourceMappingURL=cellButton.js.map