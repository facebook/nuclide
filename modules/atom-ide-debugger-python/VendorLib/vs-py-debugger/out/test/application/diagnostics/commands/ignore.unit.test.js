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
const ignore_1 = require("../../../../client/application/diagnostics/commands/ignore");
const types_1 = require("../../../../client/application/diagnostics/types");
suite('Application Diagnostics - Commands Ignore', () => {
    let ignoreCommand;
    let serviceContainer;
    let diagnostic;
    setup(() => {
        serviceContainer = typemoq.Mock.ofType();
        diagnostic = typemoq.Mock.ofType();
        ignoreCommand = new ignore_1.IgnoreDiagnosticCommand(diagnostic.object, serviceContainer.object, types_1.DiagnosticScope.Global);
    });
    test('Invoking Command should invoke the filter Service', () => __awaiter(this, void 0, void 0, function* () {
        const filterService = typemoq.Mock.ofType();
        serviceContainer.setup(s => s.get(typemoq.It.isValue(types_1.IDiagnosticFilterService)))
            .returns(() => filterService.object)
            .verifiable(typemoq.Times.once());
        diagnostic.setup(d => d.code).returns(() => 'xyz')
            .verifiable(typemoq.Times.once());
        filterService.setup(s => s.ignoreDiagnostic(typemoq.It.isValue('xyz'), typemoq.It.isValue(types_1.DiagnosticScope.Global)))
            .verifiable(typemoq.Times.once());
        yield ignoreCommand.invoke();
        serviceContainer.verifyAll();
    }));
});
//# sourceMappingURL=ignore.unit.test.js.map