// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const path = require("path");
const typeMoq = require("typemoq");
const types_1 = require("../../../client/common/types");
const argumentsHelper_1 = require("../../../client/unittests/common/argumentsHelper");
const argsService_1 = require("../../../client/unittests/nosetest/services/argsService");
const types_2 = require("../../../client/unittests/types");
suite('ArgsService: nosetest', () => {
    let argumentsService;
    suiteSetup(() => {
        const serviceContainer = typeMoq.Mock.ofType();
        const logger = typeMoq.Mock.ofType();
        serviceContainer
            .setup(s => s.get(typeMoq.It.isValue(types_1.ILogger), typeMoq.It.isAny()))
            .returns(() => logger.object);
        const argsHelper = new argumentsHelper_1.ArgumentsHelper(serviceContainer.object);
        serviceContainer
            .setup(s => s.get(typeMoq.It.isValue(types_2.IArgumentsHelper), typeMoq.It.isAny()))
            .returns(() => argsHelper);
        argumentsService = new argsService_1.ArgumentsService(serviceContainer.object);
    });
    test('Test getting the test folder in nosetest', () => {
        const dir = path.join('a', 'b', 'c');
        const args = ['anzy', '--one', '--three', dir];
        const testDirs = argumentsService.getTestFolders(args);
        chai_1.expect(testDirs).to.be.lengthOf(1);
        chai_1.expect(testDirs[0]).to.equal(dir);
    });
    test('Test getting the test folder in nosetest (with multiple dirs)', () => {
        const dir = path.join('a', 'b', 'c');
        const dir2 = path.join('a', 'b', '2');
        const args = ['anzy', '--one', '--three', dir, dir2];
        const testDirs = argumentsService.getTestFolders(args);
        chai_1.expect(testDirs).to.be.lengthOf(2);
        chai_1.expect(testDirs[0]).to.equal(dir);
        chai_1.expect(testDirs[1]).to.equal(dir2);
    });
});
//# sourceMappingURL=nosetest.argsService.unit.test.js.map