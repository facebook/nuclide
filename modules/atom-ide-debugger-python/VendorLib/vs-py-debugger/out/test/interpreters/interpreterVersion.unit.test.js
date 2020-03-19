"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
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
const path = require("path");
const typeMoq = require("typemoq");
require("../../client/common/extensions");
const interpreterVersion_1 = require("../../client/interpreter/interpreterVersion");
suite('Interpreters display version', () => {
    let processService;
    let interpreterVersionService;
    setup(() => {
        const processFactory = typeMoq.Mock.ofType();
        processService = typeMoq.Mock.ofType();
        // tslint:disable-next-line:no-any
        processService.setup((p) => p.then).returns(() => undefined);
        processFactory.setup(p => p.create()).returns(() => Promise.resolve(processService.object));
        interpreterVersionService = new interpreterVersion_1.InterpreterVersionService(processFactory.object);
    });
    test('Must return the Python Version', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = path.join('a', 'b', 'python');
        const pythonVersion = 'Output from the Procecss';
        processService
            .setup(p => p.exec(typeMoq.It.isValue(pythonPath), typeMoq.It.isValue(['--version']), typeMoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: pythonVersion }))
            .verifiable(typeMoq.Times.once());
        const pyVersion = yield interpreterVersionService.getVersion(pythonPath, 'DEFAULT_TEST_VALUE');
        chai_1.assert.equal(pyVersion, pythonVersion, 'Incorrect version');
    }));
    test('Must return the default value when Python path is invalid', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = path.join('a', 'b', 'python');
        processService
            .setup(p => p.exec(typeMoq.It.isValue(pythonPath), typeMoq.It.isValue(['--version']), typeMoq.It.isAny()))
            .returns(() => Promise.reject({}))
            .verifiable(typeMoq.Times.once());
        const pyVersion = yield interpreterVersionService.getVersion(pythonPath, 'DEFAULT_TEST_VALUE');
        chai_1.assert.equal(pyVersion, 'DEFAULT_TEST_VALUE', 'Incorrect version');
    }));
    test('Must return the pip Version.', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = path.join('a', 'b', 'python');
        const pipVersion = '1.2.3';
        processService
            .setup(p => p.exec(typeMoq.It.isValue(pythonPath), typeMoq.It.isValue(['-m', 'pip', '--version']), typeMoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: pipVersion }))
            .verifiable(typeMoq.Times.once());
        const pyVersion = yield interpreterVersionService.getPipVersion(pythonPath);
        chai_1.assert.equal(pyVersion, pipVersion, 'Incorrect version');
    }));
    test('Must throw an exception when pip version cannot be determined', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = path.join('a', 'b', 'python');
        processService
            .setup(p => p.exec(typeMoq.It.isValue(pythonPath), typeMoq.It.isValue(['-m', 'pip', '--version']), typeMoq.It.isAny()))
            .returns(() => Promise.reject('error'))
            .verifiable(typeMoq.Times.once());
        const pipVersionPromise = interpreterVersionService.getPipVersion(pythonPath);
        yield chai_1.expect(pipVersionPromise).to.be.rejectedWith();
    }));
});
//# sourceMappingURL=interpreterVersion.unit.test.js.map