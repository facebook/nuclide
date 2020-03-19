// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fileSystem_1 = require("./fileSystem");
const platformService_1 = require("./platformService");
const registry_1 = require("./registry");
const types_1 = require("./types");
function registerTypes(serviceManager) {
    serviceManager.addSingleton(types_1.IPlatformService, platformService_1.PlatformService);
    serviceManager.addSingleton(types_1.IFileSystem, fileSystem_1.FileSystem);
    if (serviceManager.get(types_1.IPlatformService).isWindows) {
        serviceManager.addSingleton(types_1.IRegistry, registry_1.RegistryImplementation);
    }
}
exports.registerTypes = registerTypes;
//# sourceMappingURL=serviceRegistry.js.map