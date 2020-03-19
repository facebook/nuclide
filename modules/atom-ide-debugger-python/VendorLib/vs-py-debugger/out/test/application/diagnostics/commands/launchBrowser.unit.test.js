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
const typemoq = require("typemoq");
const launchBrowser_1 = require("../../../../client/application/diagnostics/commands/launchBrowser");
const types_1 = require("../../../../client/common/types");
suite('Application Diagnostics - Commands Launch Browser', () => {
    let cmd;
    let serviceContainer;
    let diagnostic;
    const url = 'xyz://abc';
    setup(() => {
        serviceContainer = typemoq.Mock.ofType();
        diagnostic = typemoq.Mock.ofType();
        cmd = new launchBrowser_1.LaunchBrowserCommand(diagnostic.object, serviceContainer.object, url);
    });
    test('Invoking Command should launch the browser', () => __awaiter(this, void 0, void 0, function* () {
        const browser = typemoq.Mock.ofType();
        serviceContainer.setup(s => s.get(typemoq.It.isValue(types_1.IBrowserService)))
            .returns(() => browser.object)
            .verifiable(typemoq.Times.once());
        browser.setup(s => s.launch(typemoq.It.isValue(url)))
            .verifiable(typemoq.Times.once());
        yield cmd.invoke();
        serviceContainer.verifyAll();
    }));
});
//# sourceMappingURL=launchBrowser.unit.test.js.map