// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const linterAvailability_1 = require("./linterAvailability");
const linterManager_1 = require("./linterManager");
const lintingEngine_1 = require("./lintingEngine");
const types_1 = require("./types");
function registerTypes(serviceManager) {
    serviceManager.addSingleton(types_1.ILintingEngine, lintingEngine_1.LintingEngine);
    serviceManager.addSingleton(types_1.ILinterManager, linterManager_1.LinterManager);
    serviceManager.add(types_1.IAvailableLinterActivator, linterAvailability_1.AvailableLinterActivator);
}
exports.registerTypes = registerTypes;
//# sourceMappingURL=serviceRegistry.js.map