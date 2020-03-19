// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const React = require("react");
require("./collapseButton.css");
class CollapseButton extends React.Component {
    constructor(props) {
        super(props);
    }
    render() {
        const collapseInputPolygonClassNames = `collapse-input-svg ${this.props.open ? ' collapse-input-svg-rotate' : ''} collapse-input-svg-${this.props.theme}`;
        const collapseInputClassNames = `collapse-input remove-style ${this.props.hidden ? '' : ' hide'}`;
        return (React.createElement("div", null,
            React.createElement("button", { className: collapseInputClassNames, onClick: this.props.onClick },
                React.createElement("svg", { version: '1.1', baseProfile: 'full', width: '8px', height: '11px' },
                    React.createElement("polygon", { points: '0,0 0,10 5,5', className: collapseInputPolygonClassNames, fill: 'black' })))));
    }
}
exports.CollapseButton = CollapseButton;
//# sourceMappingURL=collapseButton.js.map