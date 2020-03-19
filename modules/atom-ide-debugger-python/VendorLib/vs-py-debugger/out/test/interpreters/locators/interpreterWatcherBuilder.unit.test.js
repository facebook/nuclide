// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:no-any max-classes-per-file max-func-body-length
const chai_1 = require("chai");
const ts_mockito_1 = require("ts-mockito");
const workspace_1 = require("../../../client/common/application/workspace");
const contracts_1 = require("../../../client/interpreter/contracts");
const interpreterWatcherBuilder_1 = require("../../../client/interpreter/locators/services/interpreterWatcherBuilder");
const container_1 = require("../../../client/ioc/container");
suite('Interpreters - Watcher Builder', () => {
    test('Build Workspace Virtual Env Watcher', () => __awaiter(this, void 0, void 0, function* () {
        const workspaceService = ts_mockito_1.mock(workspace_1.WorkspaceService);
        const serviceContainer = ts_mockito_1.mock(container_1.ServiceContainer);
        const builder = new interpreterWatcherBuilder_1.InterpreterWatcherBuilder(ts_mockito_1.instance(workspaceService), ts_mockito_1.instance(serviceContainer));
        const watcher = { register: () => Promise.resolve() };
        ts_mockito_1.when(workspaceService.getWorkspaceFolder(ts_mockito_1.anything())).thenReturn();
        ts_mockito_1.when(serviceContainer.get(contracts_1.IInterpreterWatcher, contracts_1.WORKSPACE_VIRTUAL_ENV_SERVICE)).thenReturn(watcher);
        const item = yield builder.getWorkspaceVirtualEnvInterpreterWatcher(undefined);
        chai_1.expect(item).to.be.equal(watcher, 'invalid');
    }));
    test('Ensure we cache Workspace Virtual Env Watcher', () => __awaiter(this, void 0, void 0, function* () {
        const workspaceService = ts_mockito_1.mock(workspace_1.WorkspaceService);
        const serviceContainer = ts_mockito_1.mock(container_1.ServiceContainer);
        const builder = new interpreterWatcherBuilder_1.InterpreterWatcherBuilder(ts_mockito_1.instance(workspaceService), ts_mockito_1.instance(serviceContainer));
        const watcher = { register: () => Promise.resolve() };
        ts_mockito_1.when(workspaceService.getWorkspaceFolder(ts_mockito_1.anything())).thenReturn();
        ts_mockito_1.when(serviceContainer.get(contracts_1.IInterpreterWatcher, contracts_1.WORKSPACE_VIRTUAL_ENV_SERVICE)).thenReturn(watcher);
        const [item1, item2, item3] = yield Promise.all([
            builder.getWorkspaceVirtualEnvInterpreterWatcher(undefined),
            builder.getWorkspaceVirtualEnvInterpreterWatcher(undefined),
            builder.getWorkspaceVirtualEnvInterpreterWatcher(undefined)
        ]);
        chai_1.expect(item1).to.be.equal(watcher, 'invalid');
        chai_1.expect(item2).to.be.equal(watcher, 'invalid');
        chai_1.expect(item3).to.be.equal(watcher, 'invalid');
    }));
});
//# sourceMappingURL=interpreterWatcherBuilder.unit.test.js.map