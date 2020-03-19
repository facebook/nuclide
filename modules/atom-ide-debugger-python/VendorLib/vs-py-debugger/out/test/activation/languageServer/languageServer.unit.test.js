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
const languageServer_1 = require("../../../client/activation/languageServer/languageServer");
const types_1 = require("../../../client/common/application/types");
const types_2 = require("../../../client/common/platform/types");
const types_3 = require("../../../client/common/types");
const types_4 = require("../../../client/common/variables/types");
suite('Language Server', () => {
    let serviceContainer;
    let pythonSettings;
    let appShell;
    let cmdManager;
    let workspaceService;
    let platformService;
    let languageServer;
    let extensionContext;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType();
        extensionContext = TypeMoq.Mock.ofType();
        appShell = TypeMoq.Mock.ofType();
        workspaceService = TypeMoq.Mock.ofType();
        cmdManager = TypeMoq.Mock.ofType();
        platformService = TypeMoq.Mock.ofType();
        const configService = TypeMoq.Mock.ofType();
        pythonSettings = TypeMoq.Mock.ofType();
        workspaceService.setup(w => w.hasWorkspaceFolders).returns(() => false);
        workspaceService.setup(w => w.workspaceFolders).returns(() => []);
        configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);
        const output = TypeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_3.IOutputChannel), TypeMoq.It.isAny())).returns(() => output.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.IWorkspaceService))).returns(() => workspaceService.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.IApplicationShell))).returns(() => appShell.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_3.IDisposableRegistry))).returns(() => []);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_3.IConfigurationService))).returns(() => configService.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.ICommandManager))).returns(() => cmdManager.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_2.IPlatformService))).returns(() => platformService.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_3.IExtensionContext))).returns(() => extensionContext.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_3.IFeatureDeprecationManager))).returns(() => TypeMoq.Mock.ofType().object);
        languageServer = new languageServer_1.LanguageServerExtensionActivator(serviceContainer.object);
    });
    test('Must get PYTHONPATH from env vars provider', () => __awaiter(this, void 0, void 0, function* () {
        const pathDelimiter = 'x';
        const pythonPathVar = ['A', 'B', '1'];
        const envVarsProvider = TypeMoq.Mock.ofType();
        const pathUtils = TypeMoq.Mock.ofType();
        extensionContext.setup(e => e.extensionPath).returns(() => path.join('a', 'b', 'c'));
        pathUtils.setup(p => p.delimiter).returns(() => pathDelimiter);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_4.IEnvironmentVariablesProvider))).returns(() => envVarsProvider.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_3.IPathUtils))).returns(() => pathUtils.object);
        envVarsProvider
            .setup(p => p.getEnvironmentVariables())
            .returns(() => { return Promise.resolve({ PYTHONPATH: pythonPathVar.join(pathDelimiter) }); })
            .verifiable(TypeMoq.Times.once());
        // tslint:disable-next-line:no-any
        languageServer.languageServerFolder = '';
        const options = yield languageServer.getAnalysisOptions();
        chai_1.expect(options).not.to.equal(undefined, 'options cannot be undefined');
        chai_1.expect(options.initializationOptions).not.to.equal(undefined, 'initializationOptions cannot be undefined');
        chai_1.expect(options.initializationOptions.searchPaths).to.include.members(pythonPathVar);
    }));
});
//# sourceMappingURL=languageServer.unit.test.js.map