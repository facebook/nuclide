// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const importSortProvider_1 = require("./importSortProvider");
const types_1 = require("./types");
function registerTypes(serviceManager) {
    serviceManager.addSingleton(types_1.ISortImportsEditingProvider, importSortProvider_1.SortImportsEditingProvider);
}
exports.registerTypes = registerTypes;
//# sourceMappingURL=serviceRegistry.js.map