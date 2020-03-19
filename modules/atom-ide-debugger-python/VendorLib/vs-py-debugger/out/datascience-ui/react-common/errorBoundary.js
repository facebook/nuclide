// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const React = require("react");
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, errorMessage: '' };
    }
    componentDidCatch(error, info) {
        const stack = info.componentStack;
        // Display fallback UI
        this.setState({ hasError: true, errorMessage: `${error} at \n  ${stack}` });
    }
    render() {
        if (this.state.hasError) {
            // Render our error message;
            const style = {};
            // tslint:disable-next-line:no-string-literal
            style['whiteSpace'] = 'pre';
            return React.createElement("h1", { style: style }, this.state.errorMessage);
        }
        return this.props.children;
    }
}
exports.ErrorBoundary = ErrorBoundary;
//# sourceMappingURL=errorBoundary.js.map