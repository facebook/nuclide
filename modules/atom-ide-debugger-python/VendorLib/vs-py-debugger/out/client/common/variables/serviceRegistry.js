"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
const environment_1 = require("./environment");
const environmentVariablesProvider_1 = require("./environmentVariablesProvider");
const types_1 = require("./types");
function registerTypes(serviceManager) {
    serviceManager.addSingleton(types_1.IEnvironmentVariablesService, environment_1.EnvironmentVariablesService);
    serviceManager.addSingleton(types_1.IEnvironmentVariablesProvider, environmentVariablesProvider_1.EnvironmentVariablesProvider);
}
exports.registerTypes = registerTypes;
//# sourceMappingURL=serviceRegistry.js.map