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
// tslint:disable:max-func-body-length
const chai_1 = require("chai");
const typemoq = require("typemoq");
const filter_1 = require("../../../client/application/diagnostics/filter");
const types_1 = require("../../../client/application/diagnostics/types");
const types_2 = require("../../../client/common/types");
suite('Application Diagnostics - Filter', () => {
    let globalState;
    let workspaceState;
    [
        { name: 'Global', scope: types_1.DiagnosticScope.Global, state: () => globalState, otherState: () => workspaceState },
        { name: 'Workspace', scope: types_1.DiagnosticScope.WorkspaceFolder, state: () => workspaceState, otherState: () => globalState }
    ]
        .forEach(item => {
        let serviceContainer;
        let filterService;
        setup(() => {
            globalState = typemoq.Mock.ofType();
            workspaceState = typemoq.Mock.ofType();
            serviceContainer = typemoq.Mock.ofType();
            const stateFactory = typemoq.Mock.ofType();
            stateFactory.setup(f => f.createGlobalPersistentState(typemoq.It.isValue(filter_1.FilterKeys.GlobalDiagnosticFilter), typemoq.It.isValue([])))
                .returns(() => globalState.object);
            stateFactory.setup(f => f.createWorkspacePersistentState(typemoq.It.isValue(filter_1.FilterKeys.WorkspaceDiagnosticFilter), typemoq.It.isValue([])))
                .returns(() => workspaceState.object);
            serviceContainer.setup(s => s.get(typemoq.It.isValue(types_2.IPersistentStateFactory)))
                .returns(() => stateFactory.object);
            filterService = new filter_1.DiagnosticFilterService(serviceContainer.object);
        });
        test(`ignoreDiagnostic must save codes in ${item.name} Persistent State`, () => __awaiter(this, void 0, void 0, function* () {
            const code = 'xyz';
            item.state().setup(g => g.value).returns(() => [])
                .verifiable(typemoq.Times.once());
            item.state().setup(g => g.updateValue(typemoq.It.isValue([code])))
                .verifiable(typemoq.Times.once());
            item.otherState().setup(g => g.value)
                .verifiable(typemoq.Times.never());
            item.otherState().setup(g => g.updateValue(typemoq.It.isAny()))
                .verifiable(typemoq.Times.never());
            yield filterService.ignoreDiagnostic(code, item.scope);
            item.state().verifyAll();
        }));
        test('shouldIgnoreDiagnostic should return \'false\' when code does not exist in any State', () => __awaiter(this, void 0, void 0, function* () {
            const code = 'xyz';
            item.state().setup(g => g.value).returns(() => [])
                .verifiable(typemoq.Times.once());
            item.otherState().setup(g => g.value).returns(() => [])
                .verifiable(typemoq.Times.once());
            const ignore = yield filterService.shouldIgnoreDiagnostic(code);
            chai_1.expect(ignore).to.be.equal(false, 'Incorrect value');
            item.state().verifyAll();
        }));
        test(`shouldIgnoreDiagnostic should return \'true\' when code exist in ${item.name} State`, () => __awaiter(this, void 0, void 0, function* () {
            const code = 'xyz';
            item.state().setup(g => g.value).returns(() => ['a', 'b', 'c', code])
                .verifiable(typemoq.Times.once());
            item.otherState().setup(g => g.value).returns(() => [])
                .verifiable(typemoq.Times.once());
            const ignore = yield filterService.shouldIgnoreDiagnostic(code);
            chai_1.expect(ignore).to.be.equal(true, 'Incorrect value');
            item.state().verifyAll();
        }));
        test('shouldIgnoreDiagnostic should return \'true\' when code exist in any State', () => __awaiter(this, void 0, void 0, function* () {
            const code = 'xyz';
            item.state().setup(g => g.value).returns(() => [])
                .verifiable(typemoq.Times.atLeast(0));
            item.otherState().setup(g => g.value).returns(() => ['a', 'b', 'c', code])
                .verifiable(typemoq.Times.atLeast(0));
            const ignore = yield filterService.shouldIgnoreDiagnostic(code);
            chai_1.expect(ignore).to.be.equal(true, 'Incorrect value');
            item.state().verifyAll();
        }));
        test(`ignoreDiagnostic must append codes in ${item.name} Persistent State`, () => __awaiter(this, void 0, void 0, function* () {
            const code = 'xyz';
            const currentState = ['a', 'b', 'c'];
            item.state().setup(g => g.value).returns(() => currentState)
                .verifiable(typemoq.Times.atLeastOnce());
            item.state().setup(g => g.updateValue(typemoq.It.isAny()))
                .callback(value => {
                chai_1.expect(value).to.deep.equal(currentState.concat([code]));
            })
                .verifiable(typemoq.Times.atLeastOnce());
            item.otherState().setup(g => g.value)
                .verifiable(typemoq.Times.never());
            item.otherState().setup(g => g.updateValue(typemoq.It.isAny()))
                .verifiable(typemoq.Times.never());
            yield filterService.ignoreDiagnostic(code, item.scope);
            item.state().verifyAll();
        }));
    });
});
//# sourceMappingURL=filter.unit.test.js.map