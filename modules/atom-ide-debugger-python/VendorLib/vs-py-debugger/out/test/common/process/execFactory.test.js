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
// tslint:disable:max-func-body-length no-any
const chai_1 = require("chai");
const TypeMoq = require("typemoq");
const vscode_1 = require("vscode");
const types_1 = require("../../../client/common/platform/types");
const types_2 = require("../../../client/common/process/types");
const types_3 = require("../../../client/common/types");
const types_4 = require("../../../client/common/variables/types");
const interpreterVersion_1 = require("../../../client/interpreter/interpreterVersion");
suite('PythonExecutableService', () => {
    let serviceContainer;
    let configService;
    let procService;
    let procServiceFactory;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType();
        const envVarsProvider = TypeMoq.Mock.ofType();
        procServiceFactory = TypeMoq.Mock.ofType();
        procService = TypeMoq.Mock.ofType();
        configService = TypeMoq.Mock.ofType();
        const fileSystem = TypeMoq.Mock.ofType();
        fileSystem.setup(f => f.fileExists(TypeMoq.It.isAny())).returns(() => Promise.resolve(false));
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.IFileSystem))).returns(() => fileSystem.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_4.IEnvironmentVariablesProvider))).returns(() => envVarsProvider.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_2.IProcessServiceFactory))).returns(() => procServiceFactory.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_3.IConfigurationService))).returns(() => configService.object);
        procService.setup((x) => x.then).returns(() => undefined);
        procServiceFactory.setup(p => p.create(TypeMoq.It.isAny())).returns(() => Promise.resolve(procService.object));
        envVarsProvider.setup(v => v.getEnvironmentVariables(TypeMoq.It.isAny())).returns(() => Promise.resolve({}));
    });
    test('Ensure resource is used when getting configuration service settings (undefined resource)', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = `Python_Path_${new Date().toString()}`;
        const pythonVersion = `Python_Version_${new Date().toString()}`;
        const pythonSettings = TypeMoq.Mock.ofType();
        pythonSettings.setup(p => p.pythonPath).returns(() => pythonPath);
        configService.setup(c => c.getSettings(TypeMoq.It.isValue(undefined))).returns(() => pythonSettings.object);
        procService.setup(p => p.exec(TypeMoq.It.isValue(pythonPath), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: pythonVersion }));
        const versionService = new interpreterVersion_1.InterpreterVersionService(procServiceFactory.object);
        const version = yield versionService.getVersion(pythonPath, '');
        chai_1.expect(version).to.be.equal(pythonVersion);
    }));
    test('Ensure resource is used when getting configuration service settings (defined resource)', () => __awaiter(this, void 0, void 0, function* () {
        const resource = vscode_1.Uri.file('abc');
        const pythonPath = `Python_Path_${new Date().toString()}`;
        const pythonVersion = `Python_Version_${new Date().toString()}`;
        const pythonSettings = TypeMoq.Mock.ofType();
        pythonSettings.setup(p => p.pythonPath).returns(() => pythonPath);
        configService.setup(c => c.getSettings(TypeMoq.It.isValue(resource))).returns(() => pythonSettings.object);
        procService.setup(p => p.exec(TypeMoq.It.isValue(pythonPath), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: pythonVersion }));
        const versionService = new interpreterVersion_1.InterpreterVersionService(procServiceFactory.object);
        const version = yield versionService.getVersion(pythonPath, '');
        chai_1.expect(version).to.be.equal(pythonVersion);
    }));
});
//# sourceMappingURL=execFactory.test.js.map