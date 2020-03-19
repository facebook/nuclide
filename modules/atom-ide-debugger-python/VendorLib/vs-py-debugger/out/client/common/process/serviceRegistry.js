"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
const decoder_1 = require("./decoder");
const processFactory_1 = require("./processFactory");
const pythonExecutionFactory_1 = require("./pythonExecutionFactory");
const pythonToolService_1 = require("./pythonToolService");
const types_1 = require("./types");
function registerTypes(serviceManager) {
    serviceManager.addSingleton(types_1.IBufferDecoder, decoder_1.BufferDecoder);
    serviceManager.addSingleton(types_1.IProcessServiceFactory, processFactory_1.ProcessServiceFactory);
    serviceManager.addSingleton(types_1.IPythonExecutionFactory, pythonExecutionFactory_1.PythonExecutionFactory);
    serviceManager.addSingleton(types_1.IPythonToolExecutionService, pythonToolService_1.PythonToolExecutionService);
}
exports.registerTypes = registerTypes;
//# sourceMappingURL=serviceRegistry.js.map