"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
const activation_1 = require("./activation");
const codeExecutionManager_1 = require("./codeExecution/codeExecutionManager");
const djangoShellCodeExecution_1 = require("./codeExecution/djangoShellCodeExecution");
const helper_1 = require("./codeExecution/helper");
const repl_1 = require("./codeExecution/repl");
const terminalCodeExecution_1 = require("./codeExecution/terminalCodeExecution");
const types_1 = require("./types");
function registerTypes(serviceManager) {
    serviceManager.addSingleton(types_1.ICodeExecutionHelper, helper_1.CodeExecutionHelper);
    serviceManager.addSingleton(types_1.ICodeExecutionManager, codeExecutionManager_1.CodeExecutionManager);
    serviceManager.addSingleton(types_1.ICodeExecutionService, djangoShellCodeExecution_1.DjangoShellCodeExecutionProvider, 'djangoShell');
    serviceManager.addSingleton(types_1.ICodeExecutionService, terminalCodeExecution_1.TerminalCodeExecutionProvider, 'standard');
    serviceManager.addSingleton(types_1.ICodeExecutionService, repl_1.ReplProvider, 'repl');
    serviceManager.addSingleton(types_1.ITerminalAutoActivation, activation_1.TerminalAutoActivation);
}
exports.registerTypes = registerTypes;
//# sourceMappingURL=serviceRegistry.js.map