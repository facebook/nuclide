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
const TypeMoq = require("typemoq");
const types_1 = require("../../client/common/types");
const linterManager_1 = require("../../client/linters/linterManager");
// setup class instance
class TestLinterManager extends linterManager_1.LinterManager {
    constructor() {
        super(...arguments);
        this.enableUnconfiguredLintersCallCount = 0;
    }
    enableUnconfiguredLinters(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            this.enableUnconfiguredLintersCallCount += 1;
        });
    }
}
function getServiceContainerMockForLinterManagerTests() {
    // setup test mocks
    const serviceContainerMock = TypeMoq.Mock.ofType();
    const configMock = TypeMoq.Mock.ofType();
    const pythonSettingsMock = TypeMoq.Mock.ofType();
    configMock.setup(cm => cm.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettingsMock.object);
    serviceContainerMock.setup(c => c.get(types_1.IConfigurationService)).returns(() => configMock.object);
    return serviceContainerMock;
}
// tslint:disable-next-line:max-func-body-length
suite('Lint Manager Unit Tests', () => {
    const workspaceService = TypeMoq.Mock.ofType();
    test('Linter manager isLintingEnabled checks availability when silent = false.', () => __awaiter(this, void 0, void 0, function* () {
        // set expectations
        const expectedCallCount = 1;
        const silentFlag = false;
        // get setup
        const serviceContainerMock = getServiceContainerMockForLinterManagerTests();
        // make the call
        const lm = new TestLinterManager(serviceContainerMock.object, workspaceService.object);
        yield lm.isLintingEnabled(silentFlag);
        // test expectations
        chai_1.expect(lm.enableUnconfiguredLintersCallCount).to.equal(expectedCallCount);
    }));
    test('Linter manager isLintingEnabled does not check availability when silent = true.', () => __awaiter(this, void 0, void 0, function* () {
        // set expectations
        const expectedCallCount = 0;
        const silentFlag = true;
        // get setup
        const serviceContainerMock = getServiceContainerMockForLinterManagerTests();
        // make the call
        const lm = new TestLinterManager(serviceContainerMock.object, workspaceService.object);
        yield lm.isLintingEnabled(silentFlag);
        // test expectations
        chai_1.expect(lm.enableUnconfiguredLintersCallCount).to.equal(expectedCallCount);
    }));
    test('Linter manager getActiveLinters checks availability when silent = false.', () => __awaiter(this, void 0, void 0, function* () {
        // set expectations
        const expectedCallCount = 1;
        const silentFlag = false;
        // get setup
        const serviceContainerMock = getServiceContainerMockForLinterManagerTests();
        // make the call
        const lm = new TestLinterManager(serviceContainerMock.object, workspaceService.object);
        yield lm.getActiveLinters(silentFlag);
        // test expectations
        chai_1.expect(lm.enableUnconfiguredLintersCallCount).to.equal(expectedCallCount);
    }));
    test('Linter manager getActiveLinters checks availability when silent = true.', () => __awaiter(this, void 0, void 0, function* () {
        // set expectations
        const expectedCallCount = 0;
        const silentFlag = true;
        // get setup
        const serviceContainerMock = getServiceContainerMockForLinterManagerTests();
        // make the call
        const lm = new TestLinterManager(serviceContainerMock.object, workspaceService.object);
        yield lm.getActiveLinters(silentFlag);
        // test expectations
        chai_1.expect(lm.enableUnconfiguredLintersCallCount).to.equal(expectedCallCount);
    }));
});
//# sourceMappingURL=lint.manager.unit.test.js.map