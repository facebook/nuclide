// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
class PythonCodeActionProvider {
    provideCodeActions(document, range, context, token) {
        const sortImports = new vscode.CodeAction('Sort imports', vscode.CodeActionKind.SourceOrganizeImports);
        sortImports.command = {
            title: 'Sort imports',
            command: 'python.sortImports'
        };
        return [sortImports];
    }
}
exports.PythonCodeActionProvider = PythonCodeActionProvider;
//# sourceMappingURL=codeActionsProvider.js.map