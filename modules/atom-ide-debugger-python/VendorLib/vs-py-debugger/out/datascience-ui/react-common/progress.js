// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
require("./progress.css");
const React = require("react");
class Progress extends React.Component {
    constructor(props) {
        super(props);
    }
    render() {
        // Vscode does this with two parts, a progress container and a progress bit
        return (React.createElement("div", { className: 'monaco-progress-container active infinite' },
            React.createElement("div", { className: 'progress-bit' })));
    }
}
exports.Progress = Progress;
//# sourceMappingURL=progress.js.map