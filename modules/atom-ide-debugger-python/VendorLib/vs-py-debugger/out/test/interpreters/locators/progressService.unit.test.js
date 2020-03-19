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
const async_1 = require("../../../client/common/utils/async");
const misc_1 = require("../../../client/common/utils/misc");
const progressService_1 = require("../../../client/interpreter/locators/progressService");
const container_1 = require("../../../client/ioc/container");
const core_1 = require("../../core");
suite('Interpreters - Locator Progress', () => {
    class Locator {
        onLocating(listener, thisArgs, disposables) {
            this.locatingCallback = listener;
            return { dispose: misc_1.noop };
        }
        getInterpreters(resource) {
            return Promise.resolve([]);
        }
        dispose() {
            misc_1.noop();
        }
    }
    test('Must raise refreshing event', () => __awaiter(this, void 0, void 0, function* () {
        const serviceContainer = ts_mockito_1.mock(container_1.ServiceContainer);
        const locator = new Locator();
        ts_mockito_1.when(serviceContainer.getAll(ts_mockito_1.anything())).thenReturn([locator]);
        const progress = new progressService_1.InterpreterLocatorProgressService(ts_mockito_1.instance(serviceContainer), []);
        progress.register();
        let refreshingInvoked = false;
        progress.onRefreshing(() => refreshingInvoked = true);
        let refreshedInvoked = false;
        progress.onRefreshed(() => refreshedInvoked = true);
        const locatingDeferred = async_1.createDeferred();
        locator.locatingCallback.bind(progress)(locatingDeferred.promise);
        chai_1.expect(refreshingInvoked).to.be.equal(true, 'Refreshing Not invoked');
        chai_1.expect(refreshedInvoked).to.be.equal(false, 'Refreshed invoked');
    }));
    test('Must raise refreshed event', () => __awaiter(this, void 0, void 0, function* () {
        const serviceContainer = ts_mockito_1.mock(container_1.ServiceContainer);
        const locator = new Locator();
        ts_mockito_1.when(serviceContainer.getAll(ts_mockito_1.anything())).thenReturn([locator]);
        const progress = new progressService_1.InterpreterLocatorProgressService(ts_mockito_1.instance(serviceContainer), []);
        progress.register();
        let refreshingInvoked = false;
        progress.onRefreshing(() => refreshingInvoked = true);
        let refreshedInvoked = false;
        progress.onRefreshed(() => refreshedInvoked = true);
        const locatingDeferred = async_1.createDeferred();
        locator.locatingCallback.bind(progress)(locatingDeferred.promise);
        locatingDeferred.resolve();
        yield core_1.sleep(10);
        chai_1.expect(refreshingInvoked).to.be.equal(true, 'Refreshing Not invoked');
        chai_1.expect(refreshedInvoked).to.be.equal(true, 'Refreshed not invoked');
    }));
    test('Must raise refreshed event only when all locators have completed', () => __awaiter(this, void 0, void 0, function* () {
        const serviceContainer = ts_mockito_1.mock(container_1.ServiceContainer);
        const locator1 = new Locator();
        const locator2 = new Locator();
        const locator3 = new Locator();
        ts_mockito_1.when(serviceContainer.getAll(ts_mockito_1.anything())).thenReturn([locator1, locator2, locator3]);
        const progress = new progressService_1.InterpreterLocatorProgressService(ts_mockito_1.instance(serviceContainer), []);
        progress.register();
        let refreshingInvoked = false;
        progress.onRefreshing(() => refreshingInvoked = true);
        let refreshedInvoked = false;
        progress.onRefreshed(() => refreshedInvoked = true);
        const locatingDeferred1 = async_1.createDeferred();
        locator1.locatingCallback.bind(progress)(locatingDeferred1.promise);
        const locatingDeferred2 = async_1.createDeferred();
        locator2.locatingCallback.bind(progress)(locatingDeferred2.promise);
        const locatingDeferred3 = async_1.createDeferred();
        locator3.locatingCallback.bind(progress)(locatingDeferred3.promise);
        locatingDeferred1.resolve();
        yield core_1.sleep(10);
        chai_1.expect(refreshingInvoked).to.be.equal(true, 'Refreshing Not invoked');
        chai_1.expect(refreshedInvoked).to.be.equal(false, 'Refreshed invoked');
        locatingDeferred2.resolve();
        yield core_1.sleep(10);
        chai_1.expect(refreshedInvoked).to.be.equal(false, 'Refreshed invoked');
        locatingDeferred3.resolve();
        yield core_1.sleep(10);
        chai_1.expect(refreshedInvoked).to.be.equal(true, 'Refreshed not invoked');
    }));
});
//# sourceMappingURL=progressService.unit.test.js.map