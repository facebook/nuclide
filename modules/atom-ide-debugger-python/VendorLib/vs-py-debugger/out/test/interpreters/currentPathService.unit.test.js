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
const TypeMoq = require("typemoq");
const types_1 = require("../../client/common/platform/types");
const types_2 = require("../../client/common/types");
const contracts_1 = require("../../client/interpreter/contracts");
const currentPathService_1 = require("../../client/interpreter/locators/services/currentPathService");
const types_3 = require("../../client/interpreter/virtualEnvs/types");
suite('Interpreters CurrentPath Service', () => {
    let processService;
    let fileSystem;
    let serviceContainer;
    let virtualEnvironmentManager;
    let interpreterHelper;
    let pythonSettings;
    let currentPathService;
    let persistentState;
    setup(() => __awaiter(this, void 0, void 0, function* () {
        processService = TypeMoq.Mock.ofType();
        virtualEnvironmentManager = TypeMoq.Mock.ofType();
        interpreterHelper = TypeMoq.Mock.ofType();
        const configurationService = TypeMoq.Mock.ofType();
        pythonSettings = TypeMoq.Mock.ofType();
        configurationService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);
        const persistentStateFactory = TypeMoq.Mock.ofType();
        persistentState = TypeMoq.Mock.ofType();
        processService.setup((x) => x.then).returns(() => undefined);
        persistentState.setup(p => p.value).returns(() => undefined);
        persistentState.setup(p => p.updateValue(TypeMoq.It.isAny())).returns(() => Promise.resolve());
        fileSystem = TypeMoq.Mock.ofType();
        persistentStateFactory.setup(p => p.createGlobalPersistentState(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => persistentState.object);
        const procServiceFactory = TypeMoq.Mock.ofType();
        procServiceFactory.setup(p => p.create(TypeMoq.It.isAny())).returns(() => Promise.resolve(processService.object));
        serviceContainer = TypeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_3.IVirtualEnvironmentManager), TypeMoq.It.isAny())).returns(() => virtualEnvironmentManager.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(contracts_1.IInterpreterVersionService), TypeMoq.It.isAny())).returns(() => interpreterHelper.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.IFileSystem), TypeMoq.It.isAny())).returns(() => fileSystem.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_2.IPersistentStateFactory), TypeMoq.It.isAny())).returns(() => persistentStateFactory.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_2.IConfigurationService), TypeMoq.It.isAny())).returns(() => configurationService.object);
        currentPathService = new currentPathService_1.CurrentPathService(interpreterHelper.object, procServiceFactory.object, serviceContainer.object);
    }));
    test('Interpreters that do not exist on the file system are not excluded from the list', () => __awaiter(this, void 0, void 0, function* () {
        // Specific test for 1305
        const version = 'mockVersion';
        interpreterHelper.setup(v => v.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ version }));
        const execArgs = ['-c', 'import sys;print(sys.executable)'];
        pythonSettings.setup(p => p.pythonPath).returns(() => 'root:Python');
        processService.setup(p => p.exec(TypeMoq.It.isValue('root:Python'), TypeMoq.It.isValue(execArgs), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: 'c:/root:python' })).verifiable(TypeMoq.Times.once());
        processService.setup(p => p.exec(TypeMoq.It.isValue('python'), TypeMoq.It.isValue(execArgs), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: 'c:/python1' })).verifiable(TypeMoq.Times.once());
        processService.setup(p => p.exec(TypeMoq.It.isValue('python2'), TypeMoq.It.isValue(execArgs), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: 'c:/python2' })).verifiable(TypeMoq.Times.once());
        processService.setup(p => p.exec(TypeMoq.It.isValue('python3'), TypeMoq.It.isValue(execArgs), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: 'c:/python3' })).verifiable(TypeMoq.Times.once());
        fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue('c:/root:python'))).returns(() => Promise.resolve(true)).verifiable(TypeMoq.Times.once());
        fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue('c:/python1'))).returns(() => Promise.resolve(false)).verifiable(TypeMoq.Times.once());
        fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue('c:/python2'))).returns(() => Promise.resolve(false)).verifiable(TypeMoq.Times.once());
        fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue('c:/python3'))).returns(() => Promise.resolve(true)).verifiable(TypeMoq.Times.once());
        const interpreters = yield currentPathService.getInterpreters();
        processService.verifyAll();
        fileSystem.verifyAll();
        chai_1.expect(interpreters).to.be.of.length(2);
        chai_1.expect(interpreters).to.deep.include({ version, path: 'c:/root:python', type: contracts_1.InterpreterType.Unknown });
        chai_1.expect(interpreters).to.deep.include({ version, path: 'c:/python3', type: contracts_1.InterpreterType.Unknown });
    }));
});
//# sourceMappingURL=currentPathService.unit.test.js.map