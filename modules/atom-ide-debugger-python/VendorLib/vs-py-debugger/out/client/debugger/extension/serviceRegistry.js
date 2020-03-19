// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const banner_1 = require("./banner");
const configurationProviderUtils_1 = require("./configProviders/configurationProviderUtils");
const pythonV2Provider_1 = require("./configProviders/pythonV2Provider");
const types_1 = require("./configProviders/types");
const childProcessAttachHandler_1 = require("./hooks/childProcessAttachHandler");
const childProcessAttachService_1 = require("./hooks/childProcessAttachService");
const types_2 = require("./hooks/types");
const types_3 = require("./types");
function registerTypes(serviceManager) {
    serviceManager.addSingleton(types_3.IDebugConfigurationProvider, pythonV2Provider_1.PythonV2DebugConfigurationProvider);
    serviceManager.addSingleton(types_1.IConfigurationProviderUtils, configurationProviderUtils_1.ConfigurationProviderUtils);
    serviceManager.addSingleton(types_3.IDebuggerBanner, banner_1.DebuggerBanner);
    serviceManager.addSingleton(types_2.IChildProcessAttachService, childProcessAttachService_1.ChildProcessAttachService);
    serviceManager.addSingleton(types_2.IDebugSessionEventHandlers, childProcessAttachHandler_1.ChildProcessAttachEventHandler);
}
exports.registerTypes = registerTypes;
//# sourceMappingURL=serviceRegistry.js.map