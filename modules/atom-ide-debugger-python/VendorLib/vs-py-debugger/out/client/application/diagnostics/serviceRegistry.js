// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const envPathVariable_1 = require("./checks/envPathVariable");
const invalidDebuggerType_1 = require("./checks/invalidDebuggerType");
const invalidPythonPathInDebugger_1 = require("./checks/invalidPythonPathInDebugger");
const powerShellActivation_1 = require("./checks/powerShellActivation");
const pythonInterpreter_1 = require("./checks/pythonInterpreter");
const factory_1 = require("./commands/factory");
const types_1 = require("./commands/types");
const filter_1 = require("./filter");
const promptHandler_1 = require("./promptHandler");
const types_2 = require("./types");
function registerTypes(serviceManager) {
    serviceManager.addSingleton(types_2.IDiagnosticFilterService, filter_1.DiagnosticFilterService);
    serviceManager.addSingleton(types_2.IDiagnosticHandlerService, promptHandler_1.DiagnosticCommandPromptHandlerService, promptHandler_1.DiagnosticCommandPromptHandlerServiceId);
    serviceManager.addSingleton(types_2.IDiagnosticsService, envPathVariable_1.EnvironmentPathVariableDiagnosticsService, envPathVariable_1.EnvironmentPathVariableDiagnosticsServiceId);
    serviceManager.addSingleton(types_2.IDiagnosticsService, invalidDebuggerType_1.InvalidDebuggerTypeDiagnosticsService, invalidDebuggerType_1.InvalidDebuggerTypeDiagnosticsServiceId);
    serviceManager.addSingleton(types_2.IDiagnosticsService, pythonInterpreter_1.InvalidPythonInterpreterService, pythonInterpreter_1.InvalidPythonInterpreterServiceId);
    serviceManager.addSingleton(types_2.IDiagnosticsService, invalidPythonPathInDebugger_1.InvalidPythonPathInDebuggerService, invalidPythonPathInDebugger_1.InvalidPythonPathInDebuggerServiceId);
    serviceManager.addSingleton(types_2.IDiagnosticsService, powerShellActivation_1.PowerShellActivationHackDiagnosticsService, powerShellActivation_1.PowerShellActivationHackDiagnosticsServiceId);
    serviceManager.addSingleton(types_1.IDiagnosticsCommandFactory, factory_1.DiagnosticsCommandFactory);
}
exports.registerTypes = registerTypes;
//# sourceMappingURL=serviceRegistry.js.map