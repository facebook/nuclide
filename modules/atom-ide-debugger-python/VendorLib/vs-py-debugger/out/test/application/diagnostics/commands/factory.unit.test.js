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
const chai_1 = require("chai");
const typemoq = require("typemoq");
const factory_1 = require("../../../../client/application/diagnostics/commands/factory");
const ignore_1 = require("../../../../client/application/diagnostics/commands/ignore");
const launchBrowser_1 = require("../../../../client/application/diagnostics/commands/launchBrowser");
const types_1 = require("../../../../client/application/diagnostics/types");
suite('Application Diagnostics - Commands Factory', () => {
    let commandFactory;
    setup(() => {
        const serviceContainer = typemoq.Mock.ofType();
        commandFactory = new factory_1.DiagnosticsCommandFactory(serviceContainer.object);
    });
    test('Test creation of Ignore Command', () => __awaiter(this, void 0, void 0, function* () {
        const diagnostic = typemoq.Mock.ofType();
        const command = commandFactory.createCommand(diagnostic.object, { type: 'ignore', options: types_1.DiagnosticScope.Global });
        chai_1.expect(command).to.be.instanceOf(ignore_1.IgnoreDiagnosticCommand);
    }));
    test('Test creation of Launch Browser Command', () => __awaiter(this, void 0, void 0, function* () {
        const diagnostic = typemoq.Mock.ofType();
        const command = commandFactory.createCommand(diagnostic.object, { type: 'launch', options: 'x' });
        chai_1.expect(command).to.be.instanceOf(launchBrowser_1.LaunchBrowserCommand);
    }));
});
//# sourceMappingURL=factory.unit.test.js.map