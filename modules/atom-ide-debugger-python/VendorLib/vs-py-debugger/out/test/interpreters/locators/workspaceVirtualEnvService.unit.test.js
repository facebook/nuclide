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
const interpreterWatcherBuilder_1 = require("../../../client/interpreter/locators/services/interpreterWatcherBuilder");
const workspaceVirtualEnvService_1 = require("../../../client/interpreter/locators/services/workspaceVirtualEnvService");
const container_1 = require("../../../client/ioc/container");
suite('Interpreters - Workspace VirtualEnv Service', () => {
    test('Get list of watchers', () => __awaiter(this, void 0, void 0, function* () {
        const serviceContainer = ts_mockito_1.mock(container_1.ServiceContainer);
        const builder = ts_mockito_1.mock(interpreterWatcherBuilder_1.InterpreterWatcherBuilder);
        const locator = new class extends workspaceVirtualEnvService_1.WorkspaceVirtualEnvService {
            // tslint:disable-next-line:no-unnecessary-override
            getInterpreterWatchers(resource) {
                const _super = name => super[name];
                return __awaiter(this, void 0, void 0, function* () {
                    return _super("getInterpreterWatchers").call(this, resource);
                });
            }
        }(undefined, ts_mockito_1.instance(serviceContainer), ts_mockito_1.instance(builder));
        const watchers = 1;
        ts_mockito_1.when(builder.getWorkspaceVirtualEnvInterpreterWatcher(ts_mockito_1.anything())).thenResolve(watchers);
        const items = yield locator.getInterpreterWatchers(undefined);
        chai_1.expect(items).to.deep.equal([watchers]);
        ts_mockito_1.verify(builder.getWorkspaceVirtualEnvInterpreterWatcher(ts_mockito_1.anything())).once();
    }));
});
//# sourceMappingURL=workspaceVirtualEnvService.unit.test.js.map