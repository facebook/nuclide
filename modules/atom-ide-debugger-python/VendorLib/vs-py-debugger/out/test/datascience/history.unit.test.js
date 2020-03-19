// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const TypeMoq = require("typemoq");
const types_1 = require("../../client/common/application/types");
const types_2 = require("../../client/common/types");
const datascience_1 = require("../../client/datascience/datascience");
suite('History Unit Tests', () => {
    let serviceContainer;
    let shell;
    let commandManager;
    let disposableRegistry;
    let dataScience;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType();
        commandManager = TypeMoq.Mock.ofType();
        disposableRegistry = TypeMoq.Mock.ofType();
        shell = TypeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(types_1.ICommandManager)).returns(() => commandManager.object);
        serviceContainer.setup(c => c.get(types_1.IApplicationShell)).returns(() => shell.object);
        serviceContainer.setup(c => c.get(types_2.IDisposableRegistry)).returns(() => disposableRegistry.object);
        dataScience = new datascience_1.DataScience(serviceContainer.object);
    });
});
//# sourceMappingURL=history.unit.test.js.map