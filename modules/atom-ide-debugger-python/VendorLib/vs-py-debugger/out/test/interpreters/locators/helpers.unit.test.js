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
const path = require("path");
const TypeMoq = require("typemoq");
const types_1 = require("../../../client/common/platform/types");
const enum_1 = require("../../../client/common/utils/enum");
const platform_1 = require("../../../client/common/utils/platform");
const contracts_1 = require("../../../client/interpreter/contracts");
const helpers_1 = require("../../../client/interpreter/locators/helpers");
var OS;
(function (OS) {
    OS["Windows"] = "Windows";
    OS["Linux"] = "Linux";
    OS["Mac"] = "Mac";
})(OS || (OS = {}));
suite('Interpreters - Locators Helper', () => {
    let serviceContainer;
    let platform;
    let helper;
    let fs;
    let interpreterServiceHelper;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType();
        platform = TypeMoq.Mock.ofType();
        fs = TypeMoq.Mock.ofType();
        interpreterServiceHelper = TypeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.IPlatformService))).returns(() => platform.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.IFileSystem))).returns(() => fs.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(contracts_1.IInterpreterHelper))).returns(() => interpreterServiceHelper.object);
        helper = new helpers_1.InterpreterLocatorHelper(serviceContainer.object);
    });
    test('Ensure default Mac interpreter is not excluded from the list of interpreters', () => __awaiter(this, void 0, void 0, function* () {
        platform.setup(p => p.isWindows).returns(() => false);
        platform.setup(p => p.isLinux).returns(() => false);
        platform
            .setup(p => p.isMac).returns(() => true)
            .verifiable(TypeMoq.Times.never());
        fs
            .setup(f => f.arePathsSame(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => false)
            .verifiable(TypeMoq.Times.atLeastOnce());
        const interpreters = [];
        ['conda', 'virtualenv', 'mac', 'pyenv'].forEach(name => {
            const interpreter = {
                architecture: platform_1.Architecture.Unknown,
                displayName: name,
                path: path.join('users', 'python', 'bin', name),
                sysPrefix: name,
                sysVersion: name,
                type: contracts_1.InterpreterType.Unknown,
                version: name,
                version_info: [0, 0, 0, 'alpha']
            };
            interpreters.push(interpreter);
            // Treat 'mac' as as mac interpreter.
            interpreterServiceHelper
                .setup(i => i.isMacDefaultPythonPath(TypeMoq.It.isValue(interpreter.path)))
                .returns(() => name === 'mac')
                .verifiable(TypeMoq.Times.never());
        });
        const expectedInterpreters = interpreters.slice(0);
        const items = helper.mergeInterpreters(interpreters);
        interpreterServiceHelper.verifyAll();
        platform.verifyAll();
        fs.verifyAll();
        chai_1.expect(items).to.be.lengthOf(4);
        chai_1.expect(items).to.be.deep.equal(expectedInterpreters);
    }));
    enum_1.getNamesAndValues(OS).forEach(os => {
        test(`Ensure duplicates are removed (same version and same interpreter directory on ${os.name})`, () => __awaiter(this, void 0, void 0, function* () {
            interpreterServiceHelper
                .setup(i => i.isMacDefaultPythonPath(TypeMoq.It.isAny()))
                .returns(() => false);
            platform.setup(p => p.isWindows).returns(() => os.value === OS.Windows);
            platform.setup(p => p.isLinux).returns(() => os.value === OS.Linux);
            platform.setup(p => p.isMac).returns(() => os.value === OS.Mac);
            fs
                .setup(f => f.arePathsSame(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .returns((a, b) => a === b)
                .verifiable(TypeMoq.Times.atLeastOnce());
            const interpreters = [];
            const expectedInterpreters = [];
            // Unique python paths and versions.
            ['3.6', '3.6', '2.7', '2.7'].forEach((name, index) => {
                const interpreter = {
                    architecture: platform_1.Architecture.Unknown,
                    displayName: name,
                    path: path.join('users', `python${name}${index}`, 'bin', name + index.toString()),
                    sysPrefix: name,
                    sysVersion: name,
                    type: contracts_1.InterpreterType.Unknown,
                    version: name,
                    version_info: [3, parseInt(name.substr(-1), 10), 0, 'final']
                };
                interpreters.push(interpreter);
                expectedInterpreters.push(interpreter);
            });
            // Same versions, but different executables.
            ['3.6', '3.6', '3.7', '3.7'].forEach((name, index) => {
                const interpreter = {
                    architecture: platform_1.Architecture.Unknown,
                    displayName: name,
                    path: path.join('users', 'python', 'bin', 'python.exe'),
                    sysPrefix: name,
                    sysVersion: name,
                    type: contracts_1.InterpreterType.Unknown,
                    version: name,
                    version_info: [3, parseInt(name.substr(-1), 10), 0, 'final']
                };
                const duplicateInterpreter = {
                    architecture: platform_1.Architecture.Unknown,
                    displayName: name,
                    path: path.join('users', 'python', 'bin', `python${name}.exe`),
                    sysPrefix: name,
                    sysVersion: name,
                    type: contracts_1.InterpreterType.Unknown,
                    version: name,
                    version_info: interpreter.version_info
                };
                interpreters.push(interpreter);
                interpreters.push(duplicateInterpreter);
                if (index % 2 === 1) {
                    expectedInterpreters.push(interpreter);
                }
            });
            const items = helper.mergeInterpreters(interpreters);
            interpreterServiceHelper.verifyAll();
            platform.verifyAll();
            fs.verifyAll();
            chai_1.expect(items).to.be.lengthOf(expectedInterpreters.length);
            chai_1.expect(items).to.be.deep.equal(expectedInterpreters);
        }));
    });
    enum_1.getNamesAndValues(OS).forEach(os => {
        test(`Ensure interpreter types are identified from other locators (${os.name})`, () => __awaiter(this, void 0, void 0, function* () {
            interpreterServiceHelper
                .setup(i => i.isMacDefaultPythonPath(TypeMoq.It.isAny()))
                .returns(() => false);
            platform.setup(p => p.isWindows).returns(() => os.value === OS.Windows);
            platform.setup(p => p.isLinux).returns(() => os.value === OS.Linux);
            platform.setup(p => p.isMac).returns(() => os.value === OS.Mac);
            fs
                .setup(f => f.arePathsSame(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .returns((a, b) => a === b && a === path.join('users', 'python', 'bin'))
                .verifiable(TypeMoq.Times.atLeastOnce());
            const interpreters = [];
            const expectedInterpreters = [];
            ['3.6', '3.6'].forEach((name, index) => {
                // Ensure the type in the first item is 'Unknown',
                // and type in second item is known (e.g. Conda).
                const type = index === 0 ? contracts_1.InterpreterType.Unknown : contracts_1.InterpreterType.PipEnv;
                const interpreter = {
                    architecture: platform_1.Architecture.Unknown,
                    displayName: name,
                    path: path.join('users', 'python', 'bin', 'python.exe'),
                    sysPrefix: name,
                    sysVersion: name,
                    type,
                    version: name,
                    version_info: [3, parseInt(name.substr(-1), 10), 0, 'final']
                };
                interpreters.push(interpreter);
                if (index === 1) {
                    expectedInterpreters.push(interpreter);
                }
            });
            const items = helper.mergeInterpreters(interpreters);
            interpreterServiceHelper.verifyAll();
            platform.verifyAll();
            fs.verifyAll();
            chai_1.expect(items).to.be.lengthOf(1);
            chai_1.expect(items).to.be.deep.equal(expectedInterpreters);
        }));
    });
});
//# sourceMappingURL=helpers.unit.test.js.map