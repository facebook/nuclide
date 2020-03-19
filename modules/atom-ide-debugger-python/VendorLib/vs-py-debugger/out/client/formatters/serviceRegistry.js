"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
const helper_1 = require("./helper");
const types_1 = require("./types");
function registerTypes(serviceManager) {
    serviceManager.addSingleton(types_1.IFormatterHelper, helper_1.FormatterHelper);
}
exports.registerTypes = registerTypes;
//# sourceMappingURL=serviceRegistry.js.map