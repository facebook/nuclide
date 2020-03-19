// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const path = require("path");
const typeMoq = require("typemoq");
const types_1 = require("../../../client/common/types");
const argumentsHelper_1 = require("../../../client/unittests/common/argumentsHelper");
const types_2 = require("../../../client/unittests/types");
const argsService_1 = require("../../../client/unittests/unittest/services/argsService");
suite('ArgsService: unittest', () => {
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
    test('Test getting the test folder in unittest with -s', () => {
        const dir = path.join('a', 'b', 'c');
        const args = ['anzy', '--one', '--three', '-s', dir];
        const testDirs = argumentsService.getTestFolders(args);
        chai_1.expect(testDirs).to.be.lengthOf(1);
        chai_1.expect(testDirs[0]).to.equal(dir);
    });
    test('Test getting the test folder in unittest with -s in the middle', () => {
        const dir = path.join('a', 'b', 'c');
        const args = ['anzy', '--one', '--three', '-s', dir, 'some other', '--value', '1234'];
        const testDirs = argumentsService.getTestFolders(args);
        chai_1.expect(testDirs).to.be.lengthOf(1);
        chai_1.expect(testDirs[0]).to.equal(dir);
    });
    test('Test getting the test folder in unittest with --start-directory', () => {
        const dir = path.join('a', 'b', 'c');
        const args = ['anzy', '--one', '--three', '--start-directory', dir];
        const testDirs = argumentsService.getTestFolders(args);
        chai_1.expect(testDirs).to.be.lengthOf(1);
        chai_1.expect(testDirs[0]).to.equal(dir);
    });
    test('Test getting the test folder in unittest with --start-directory in the middle', () => {
        const dir = path.join('a', 'b', 'c');
        const args = ['anzy', '--one', '--three', '--start-directory', dir, 'some other', '--value', '1234'];
        const testDirs = argumentsService.getTestFolders(args);
        chai_1.expect(testDirs).to.be.lengthOf(1);
        chai_1.expect(testDirs[0]).to.equal(dir);
    });
});
//# sourceMappingURL=unittest.argsService.unit.test.js.map