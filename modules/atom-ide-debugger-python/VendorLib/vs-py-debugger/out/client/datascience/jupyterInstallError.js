// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
require("../common/extensions");
const constants_1 = require("./constants");
class JupyterInstallError extends Error {
    constructor(message, actionFormatString) {
        super(message);
        this.action = constants_1.HelpLinks.PythonInteractiveHelpLink;
        this.actionTitle = actionFormatString.format(constants_1.HelpLinks.PythonInteractiveHelpLink);
    }
}
exports.JupyterInstallError = JupyterInstallError;
//# sourceMappingURL=jupyterInstallError.js.map