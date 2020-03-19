// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const React = require("react");
const types_1 = require("../../client/datascience/types");
require("./executionCount.css");
class ExecutionCount extends React.Component {
    constructor(props) {
        super(props);
    }
    render() {
        const isBusy = this.props.cell.state === types_1.CellState.init || this.props.cell.state === types_1.CellState.executing;
        if (this.props.visible) {
            return isBusy ?
                (React.createElement("div", { className: 'execution-count-busy-outer' },
                    "[",
                    React.createElement("svg", { className: 'execution-count-busy-svg', viewBox: '0 0 100 100' },
                        React.createElement("polyline", { points: '50,0, 50,50, 85,15, 50,50, 100,50, 50,50, 85,85, 50,50 50,100 50,50 15,85 50,50 0,50 50,50 15,15', className: 'execution-count-busy-polyline' })),
                    "]")) :
                (React.createElement("div", { className: 'execution-count' }, `[${this.props.cell.data.execution_count}]`));
        }
        else {
            return null;
        }
    }
}
exports.ExecutionCount = ExecutionCount;
//# sourceMappingURL=executionCount.js.map