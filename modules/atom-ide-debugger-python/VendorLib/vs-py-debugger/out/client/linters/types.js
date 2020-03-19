// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.IAvailableLinterActivator = Symbol('IAvailableLinterActivator');
exports.ILinterManager = Symbol('ILinterManager');
var LintMessageSeverity;
(function (LintMessageSeverity) {
    LintMessageSeverity[LintMessageSeverity["Hint"] = 0] = "Hint";
    LintMessageSeverity[LintMessageSeverity["Error"] = 1] = "Error";
    LintMessageSeverity[LintMessageSeverity["Warning"] = 2] = "Warning";
    LintMessageSeverity[LintMessageSeverity["Information"] = 3] = "Information";
})(LintMessageSeverity = exports.LintMessageSeverity || (exports.LintMessageSeverity = {}));
exports.ILintingEngine = Symbol('ILintingEngine');
//# sourceMappingURL=types.js.map