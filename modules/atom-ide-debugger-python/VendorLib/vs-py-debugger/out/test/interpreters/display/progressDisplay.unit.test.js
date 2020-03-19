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
// tslint:disable:no-any
const chai_1 = require("chai");
const ts_mockito_1 = require("ts-mockito");
const applicationShell_1 = require("../../../client/common/application/applicationShell");
const localize_1 = require("../../../client/common/utils/localize");
const misc_1 = require("../../../client/common/utils/misc");
const progressDisplay_1 = require("../../../client/interpreter/display/progressDisplay");
suite('Interpreters - Display Progress', () => {
    let refreshingCallback;
    let refreshedCallback;
    const progressService = {
        onRefreshing(listener) {
            refreshingCallback = listener;
            return { dispose: misc_1.noop };
        },
        onRefreshed(listener) {
            refreshedCallback = listener;
            return { dispose: misc_1.noop };
        },
        register() {
            misc_1.noop();
        }
    };
    test('Display loading message when refreshing interpreters for the first time', () => __awaiter(this, void 0, void 0, function* () {
        const shell = ts_mockito_1.mock(applicationShell_1.ApplicationShell);
        const statusBar = new progressDisplay_1.InterpreterLocatorProgressStatubarHandler(ts_mockito_1.instance(shell), progressService, []);
        ts_mockito_1.when(shell.withProgress(ts_mockito_1.anything(), ts_mockito_1.anything())).thenResolve();
        statusBar.register();
        refreshingCallback(undefined);
        const options = ts_mockito_1.capture(shell.withProgress).last()[0];
        chai_1.expect(options.title).to.be.equal(localize_1.Interpreters.loading());
    }));
    test('Display refreshing message when refreshing interpreters for the second time', () => __awaiter(this, void 0, void 0, function* () {
        const shell = ts_mockito_1.mock(applicationShell_1.ApplicationShell);
        const statusBar = new progressDisplay_1.InterpreterLocatorProgressStatubarHandler(ts_mockito_1.instance(shell), progressService, []);
        ts_mockito_1.when(shell.withProgress(ts_mockito_1.anything(), ts_mockito_1.anything())).thenResolve();
        statusBar.register();
        refreshingCallback(undefined);
        let options = ts_mockito_1.capture(shell.withProgress).last()[0];
        chai_1.expect(options.title).to.be.equal(localize_1.Interpreters.loading());
        refreshingCallback(undefined);
        options = ts_mockito_1.capture(shell.withProgress).last()[0];
        chai_1.expect(options.title).to.be.equal(localize_1.Interpreters.refreshing());
    }));
    test('Progress message is hidden when loading has completed', () => __awaiter(this, void 0, void 0, function* () {
        const shell = ts_mockito_1.mock(applicationShell_1.ApplicationShell);
        const statusBar = new progressDisplay_1.InterpreterLocatorProgressStatubarHandler(ts_mockito_1.instance(shell), progressService, []);
        ts_mockito_1.when(shell.withProgress(ts_mockito_1.anything(), ts_mockito_1.anything())).thenResolve();
        statusBar.register();
        refreshingCallback(undefined);
        const options = ts_mockito_1.capture(shell.withProgress).last()[0];
        const callback = ts_mockito_1.capture(shell.withProgress).last()[1];
        const promise = callback(undefined, undefined);
        chai_1.expect(options.title).to.be.equal(localize_1.Interpreters.loading());
        refreshedCallback(undefined);
        // Promise must resolve when refreshed callback is invoked.
        // When promise resolves, the progress message is hidden by VSC.
        yield promise;
    }));
});
//# sourceMappingURL=progressDisplay.unit.test.js.map