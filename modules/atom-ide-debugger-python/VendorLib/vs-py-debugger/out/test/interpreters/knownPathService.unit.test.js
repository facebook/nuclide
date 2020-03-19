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
// tslint:disable:max-func-body-length no-any
const chai_1 = require("chai");
const path = require("path");
const TypeMoq = require("typemoq");
const types_1 = require("../../client/common/platform/types");
const types_2 = require("../../client/common/types");
const KnownPathsService_1 = require("../../client/interpreter/locators/services/KnownPathsService");
suite('Interpreters Known Paths', () => {
    let serviceContainer;
    let currentProcess;
    let platformService;
    let pathUtils;
    let knownSearchPaths;
    setup(() => __awaiter(this, void 0, void 0, function* () {
        serviceContainer = TypeMoq.Mock.ofType();
        currentProcess = TypeMoq.Mock.ofType();
        platformService = TypeMoq.Mock.ofType();
        pathUtils = TypeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_2.ICurrentProcess), TypeMoq.It.isAny())).returns(() => currentProcess.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.IPlatformService), TypeMoq.It.isAny())).returns(() => platformService.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_2.IPathUtils), TypeMoq.It.isAny())).returns(() => pathUtils.object);
        knownSearchPaths = new KnownPathsService_1.KnownSearchPathsForInterpreters(serviceContainer.object);
    }));
    test('Ensure known list of paths are returned', () => __awaiter(this, void 0, void 0, function* () {
        const pathDelimiter = 'X';
        const pathsInPATHVar = [path.join('a', 'b', 'c'), '', path.join('1', '2'), '3'];
        pathUtils.setup(p => p.delimiter).returns(() => pathDelimiter);
        platformService.setup(p => p.isWindows).returns(() => true);
        platformService.setup(p => p.pathVariableName).returns(() => 'PATH');
        currentProcess.setup(p => p.env).returns(() => {
            return { PATH: pathsInPATHVar.join(pathDelimiter) };
        });
        const expectedPaths = [...pathsInPATHVar].filter(item => item.length > 0);
        const paths = knownSearchPaths.getSearchPaths();
        chai_1.expect(paths).to.deep.equal(expectedPaths);
    }));
    test('Ensure known list of paths are returned on non-windows', () => __awaiter(this, void 0, void 0, function* () {
        const homeDir = '/users/peter Smith';
        const pathDelimiter = 'X';
        pathUtils.setup(p => p.delimiter).returns(() => pathDelimiter);
        pathUtils.setup(p => p.home).returns(() => homeDir);
        platformService.setup(p => p.isWindows).returns(() => false);
        platformService.setup(p => p.pathVariableName).returns(() => 'PATH');
        currentProcess.setup(p => p.env).returns(() => {
            return { PATH: '' };
        });
        const expectedPaths = [];
        ['/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin', '/usr/local/sbin']
            .forEach(p => {
            expectedPaths.push(p);
            expectedPaths.push(path.join(homeDir, p));
        });
        expectedPaths.push(path.join(homeDir, 'anaconda', 'bin'));
        expectedPaths.push(path.join(homeDir, 'python', 'bin'));
        const paths = knownSearchPaths.getSearchPaths();
        chai_1.expect(paths).to.deep.equal(expectedPaths);
    }));
    test('Ensure PATH variable and known list of paths are merged on non-windows', () => __awaiter(this, void 0, void 0, function* () {
        const homeDir = '/users/peter Smith';
        const pathDelimiter = 'X';
        const pathsInPATHVar = [path.join('a', 'b', 'c'), '', path.join('1', '2'), '3'];
        pathUtils.setup(p => p.delimiter).returns(() => pathDelimiter);
        pathUtils.setup(p => p.home).returns(() => homeDir);
        platformService.setup(p => p.isWindows).returns(() => false);
        platformService.setup(p => p.pathVariableName).returns(() => 'PATH');
        currentProcess.setup(p => p.env).returns(() => {
            return { PATH: pathsInPATHVar.join(pathDelimiter) };
        });
        const expectedPaths = [...pathsInPATHVar].filter(item => item.length > 0);
        ['/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin', '/usr/local/sbin']
            .forEach(p => {
            expectedPaths.push(p);
            expectedPaths.push(path.join(homeDir, p));
        });
        expectedPaths.push(path.join(homeDir, 'anaconda', 'bin'));
        expectedPaths.push(path.join(homeDir, 'python', 'bin'));
        const paths = knownSearchPaths.getSearchPaths();
        chai_1.expect(paths).to.deep.equal(expectedPaths);
    }));
});
//# sourceMappingURL=knownPathService.unit.test.js.map