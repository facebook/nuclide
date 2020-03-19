// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const applicationDiagnostics_1 = require("./diagnostics/applicationDiagnostics");
const serviceRegistry_1 = require("./diagnostics/serviceRegistry");
const types_1 = require("./types");
function registerTypes(serviceManager) {
    serviceManager.addSingleton(types_1.IApplicationDiagnostics, applicationDiagnostics_1.ApplicationDiagnostics);
    serviceRegistry_1.registerTypes(serviceManager);
}
exports.registerTypes = registerTypes;
//# sourceMappingURL=serviceRegistry.js.map