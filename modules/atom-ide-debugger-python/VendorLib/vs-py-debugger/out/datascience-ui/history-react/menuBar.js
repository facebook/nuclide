// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
require("./menuBar.css");
const React = require("react");
// Simple 'bar'. Came up with the css by playing around here:
// https://www.w3schools.com/cssref/tryit.asp?filename=trycss_float
class MenuBar extends React.Component {
    constructor(props) {
        super(props);
    }
    render() {
        const classNames = this.props.stylePosition ?
            `menuBar-${this.props.stylePosition} menuBar-${this.props.stylePosition}-${this.props.theme}`
            : 'menuBar';
        return (React.createElement("div", { className: classNames }, this.props.children));
    }
}
exports.MenuBar = MenuBar;
//# sourceMappingURL=menuBar.js.map