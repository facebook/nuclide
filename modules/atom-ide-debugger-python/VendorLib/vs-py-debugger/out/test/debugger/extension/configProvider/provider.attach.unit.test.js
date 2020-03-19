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
// tslint:disable:max-func-body-length no-invalid-template-strings no-any no-object-literal-type-assertion no-invalid-this
const chai_1 = require("chai");
const path = require("path");
const TypeMoq = require("typemoq");
const vscode_1 = require("vscode");
const types_1 = require("../../../../client/common/application/types");
const constants_1 = require("../../../../client/common/constants");
const types_2 = require("../../../../client/common/platform/types");
const enum_1 = require("../../../../client/common/utils/enum");
const constants_2 = require("../../../../client/debugger/constants");
const pythonV2Provider_1 = require("../../../../client/debugger/extension/configProviders/pythonV2Provider");
const types_3 = require("../../../../client/debugger/types");
var OS;
(function (OS) {
    OS[OS["Windows"] = 0] = "Windows";
    OS[OS["Mac"] = 1] = "Mac";
    OS[OS["Linux"] = 2] = "Linux";
})(OS || (OS = {}));
[
    { debugType: constants_2.DebuggerTypeName, class: pythonV2Provider_1.PythonV2DebugConfigurationProvider }
].forEach(provider => {
    enum_1.getNamesAndValues(OS).forEach(os => {
        suite(`Debugging - Config Provider attach, ${provider.debugType}, OS = ${os.name}`, () => {
            let serviceContainer;
            let debugProvider;
            let platformService;
            let fileSystem;
            const debugOptionsAvailable = [types_3.DebugOptions.RedirectOutput];
            if (os.value === OS.Windows) {
                debugOptionsAvailable.push(types_3.DebugOptions.FixFilePathCase);
                debugOptionsAvailable.push(types_3.DebugOptions.WindowsClient);
            }
            else {
                debugOptionsAvailable.push(types_3.DebugOptions.UnixClient);
            }
            setup(() => {
                serviceContainer = TypeMoq.Mock.ofType();
                platformService = TypeMoq.Mock.ofType();
                fileSystem = TypeMoq.Mock.ofType();
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_2.IPlatformService))).returns(() => platformService.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_2.IFileSystem))).returns(() => fileSystem.object);
                platformService.setup(p => p.isWindows).returns(() => os.value === OS.Windows);
                platformService.setup(p => p.isMac).returns(() => os.value === OS.Mac);
                platformService.setup(p => p.isLinux).returns(() => os.value === OS.Linux);
                debugProvider = new provider.class(serviceContainer.object);
            });
            function createMoqWorkspaceFolder(folderPath) {
                const folder = TypeMoq.Mock.ofType();
                folder.setup(f => f.uri).returns(() => vscode_1.Uri.file(folderPath));
                return folder.object;
            }
            function setupActiveEditor(fileName, languageId) {
                const documentManager = TypeMoq.Mock.ofType();
                if (fileName) {
                    const textEditor = TypeMoq.Mock.ofType();
                    const document = TypeMoq.Mock.ofType();
                    document.setup(d => d.languageId).returns(() => languageId);
                    document.setup(d => d.fileName).returns(() => fileName);
                    textEditor.setup(t => t.document).returns(() => document.object);
                    documentManager.setup(d => d.activeTextEditor).returns(() => textEditor.object);
                }
                else {
                    documentManager.setup(d => d.activeTextEditor).returns(() => undefined);
                }
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.IDocumentManager))).returns(() => documentManager.object);
            }
            function setupWorkspaces(folders) {
                const workspaceService = TypeMoq.Mock.ofType();
                const workspaceFolders = folders.map(createMoqWorkspaceFolder);
                workspaceService.setup(w => w.workspaceFolders).returns(() => workspaceFolders);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.IWorkspaceService))).returns(() => workspaceService.object);
            }
            test('Defaults should be returned when an empty object is passed with a Workspace Folder and active file', () => __awaiter(this, void 0, void 0, function* () {
                const workspaceFolder = createMoqWorkspaceFolder(__dirname);
                const pythonFile = 'xyz.py';
                setupActiveEditor(pythonFile, constants_1.PYTHON_LANGUAGE);
                const debugConfig = yield debugProvider.resolveDebugConfiguration(workspaceFolder, { request: 'attach' });
                chai_1.expect(Object.keys(debugConfig)).to.have.lengthOf.above(3);
                chai_1.expect(debugConfig).to.have.property('request', 'attach');
                chai_1.expect(debugConfig).to.have.property('debugOptions').deep.equal(debugOptionsAvailable);
            }));
            test('Defaults should be returned when an empty object is passed without Workspace Folder, no workspaces and active file', () => __awaiter(this, void 0, void 0, function* () {
                const pythonFile = 'xyz.py';
                setupActiveEditor(pythonFile, constants_1.PYTHON_LANGUAGE);
                setupWorkspaces([]);
                const debugConfig = yield debugProvider.resolveDebugConfiguration(undefined, { request: 'attach' });
                chai_1.expect(Object.keys(debugConfig)).to.have.lengthOf.least(3);
                chai_1.expect(debugConfig).to.have.property('request', 'attach');
                chai_1.expect(debugConfig).to.have.property('debugOptions').deep.equal(debugOptionsAvailable);
                chai_1.expect(debugConfig).to.have.property('host', 'localhost');
            }));
            test('Defaults should be returned when an empty object is passed without Workspace Folder, no workspaces and no active file', () => __awaiter(this, void 0, void 0, function* () {
                setupActiveEditor(undefined, constants_1.PYTHON_LANGUAGE);
                setupWorkspaces([]);
                const debugConfig = yield debugProvider.resolveDebugConfiguration(undefined, { request: 'attach' });
                chai_1.expect(Object.keys(debugConfig)).to.have.lengthOf.least(3);
                chai_1.expect(debugConfig).to.have.property('request', 'attach');
                chai_1.expect(debugConfig).to.have.property('debugOptions').deep.equal(debugOptionsAvailable);
                chai_1.expect(debugConfig).to.have.property('host', 'localhost');
            }));
            test('Defaults should be returned when an empty object is passed without Workspace Folder, no workspaces and non python file', () => __awaiter(this, void 0, void 0, function* () {
                const activeFile = 'xyz.js';
                setupActiveEditor(activeFile, 'javascript');
                setupWorkspaces([]);
                const debugConfig = yield debugProvider.resolveDebugConfiguration(undefined, { request: 'attach' });
                chai_1.expect(Object.keys(debugConfig)).to.have.lengthOf.least(3);
                chai_1.expect(debugConfig).to.have.property('request', 'attach');
                chai_1.expect(debugConfig).to.have.property('debugOptions').deep.equal(debugOptionsAvailable);
                chai_1.expect(debugConfig).to.not.have.property('localRoot');
                chai_1.expect(debugConfig).to.have.property('host', 'localhost');
            }));
            test('Defaults should be returned when an empty object is passed without Workspace Folder, with a workspace and an active python file', () => __awaiter(this, void 0, void 0, function* () {
                const activeFile = 'xyz.py';
                setupActiveEditor(activeFile, constants_1.PYTHON_LANGUAGE);
                const defaultWorkspace = path.join('usr', 'desktop');
                setupWorkspaces([defaultWorkspace]);
                const debugConfig = yield debugProvider.resolveDebugConfiguration(undefined, { request: 'attach' });
                chai_1.expect(Object.keys(debugConfig)).to.have.lengthOf.least(3);
                chai_1.expect(debugConfig).to.have.property('request', 'attach');
                chai_1.expect(debugConfig).to.have.property('debugOptions').deep.equal(debugOptionsAvailable);
                chai_1.expect(debugConfig).to.have.property('host', 'localhost');
            }));
            test('Ensure \'localRoot\' is left unaltered', () => __awaiter(this, void 0, void 0, function* () {
                const activeFile = 'xyz.py';
                const workspaceFolder = createMoqWorkspaceFolder(__dirname);
                setupActiveEditor(activeFile, constants_1.PYTHON_LANGUAGE);
                const defaultWorkspace = path.join('usr', 'desktop');
                setupWorkspaces([defaultWorkspace]);
                const localRoot = `Debug_PythonPath_${new Date().toString()}`;
                const debugConfig = yield debugProvider.resolveDebugConfiguration(workspaceFolder, { localRoot, request: 'attach' });
                chai_1.expect(debugConfig).to.have.property('localRoot', localRoot);
            }));
            ['localhost', '127.0.0.1', '::1'].forEach(host => {
                test(`Ensure path mappings are automatically added when host is '${host}'`, () => __awaiter(this, void 0, void 0, function* () {
                    const activeFile = 'xyz.py';
                    const workspaceFolder = createMoqWorkspaceFolder(__dirname);
                    setupActiveEditor(activeFile, constants_1.PYTHON_LANGUAGE);
                    const defaultWorkspace = path.join('usr', 'desktop');
                    setupWorkspaces([defaultWorkspace]);
                    const localRoot = `Debug_PythonPath_${new Date().toString()}`;
                    const debugConfig = yield debugProvider.resolveDebugConfiguration(workspaceFolder, { localRoot, host, request: 'attach' });
                    chai_1.expect(debugConfig).to.have.property('localRoot', localRoot);
                    const pathMappings = debugConfig.pathMappings;
                    chai_1.expect(pathMappings).to.be.lengthOf(1);
                    chai_1.expect(pathMappings[0].localRoot).to.be.equal(workspaceFolder.uri.fsPath);
                    chai_1.expect(pathMappings[0].remoteRoot).to.be.equal(workspaceFolder.uri.fsPath);
                }));
            });
            ['192.168.1.123', 'don.debugger.com'].forEach(host => {
                test(`Ensure path mappings are not automatically added when host is '${host}'`, () => __awaiter(this, void 0, void 0, function* () {
                    const activeFile = 'xyz.py';
                    const workspaceFolder = createMoqWorkspaceFolder(__dirname);
                    setupActiveEditor(activeFile, constants_1.PYTHON_LANGUAGE);
                    const defaultWorkspace = path.join('usr', 'desktop');
                    setupWorkspaces([defaultWorkspace]);
                    const localRoot = `Debug_PythonPath_${new Date().toString()}`;
                    const debugConfig = yield debugProvider.resolveDebugConfiguration(workspaceFolder, { localRoot, host, request: 'attach' });
                    chai_1.expect(debugConfig).to.have.property('localRoot', localRoot);
                    const pathMappings = debugConfig.pathMappings;
                    chai_1.expect(pathMappings).to.be.lengthOf(0);
                }));
            });
            test('Ensure \'localRoot\' and \'remoteRoot\' is used', () => __awaiter(this, void 0, void 0, function* () {
                const activeFile = 'xyz.py';
                const workspaceFolder = createMoqWorkspaceFolder(__dirname);
                setupActiveEditor(activeFile, constants_1.PYTHON_LANGUAGE);
                const defaultWorkspace = path.join('usr', 'desktop');
                setupWorkspaces([defaultWorkspace]);
                const localRoot = `Debug_PythonPath_Local_Root_${new Date().toString()}`;
                const remoteRoot = `Debug_PythonPath_Remote_Root_${new Date().toString()}`;
                const debugConfig = yield debugProvider.resolveDebugConfiguration(workspaceFolder, { localRoot, remoteRoot, request: 'attach' });
                chai_1.expect(debugConfig.pathMappings).to.be.lengthOf(1);
                chai_1.expect(debugConfig.pathMappings).to.deep.include({ localRoot, remoteRoot });
            }));
            test('Ensure \'localRoot\' and \'remoteRoot\' is used', () => __awaiter(this, void 0, void 0, function* () {
                const activeFile = 'xyz.py';
                const workspaceFolder = createMoqWorkspaceFolder(__dirname);
                setupActiveEditor(activeFile, constants_1.PYTHON_LANGUAGE);
                const defaultWorkspace = path.join('usr', 'desktop');
                setupWorkspaces([defaultWorkspace]);
                const localRoot = `Debug_PythonPath_Local_Root_${new Date().toString()}`;
                const remoteRoot = `Debug_PythonPath_Remote_Root_${new Date().toString()}`;
                const debugConfig = yield debugProvider.resolveDebugConfiguration(workspaceFolder, { localRoot, remoteRoot, request: 'attach' });
                chai_1.expect(debugConfig.pathMappings).to.be.lengthOf(1);
                chai_1.expect(debugConfig.pathMappings).to.deep.include({ localRoot, remoteRoot });
            }));
            test('Ensure \'remoteRoot\' is left unaltered', () => __awaiter(this, void 0, void 0, function* () {
                const activeFile = 'xyz.py';
                const workspaceFolder = createMoqWorkspaceFolder(__dirname);
                setupActiveEditor(activeFile, constants_1.PYTHON_LANGUAGE);
                const defaultWorkspace = path.join('usr', 'desktop');
                setupWorkspaces([defaultWorkspace]);
                const remoteRoot = `Debug_PythonPath_${new Date().toString()}`;
                const debugConfig = yield debugProvider.resolveDebugConfiguration(workspaceFolder, { remoteRoot, request: 'attach' });
                chai_1.expect(debugConfig).to.have.property('remoteRoot', remoteRoot);
            }));
            test('Ensure \'port\' is left unaltered', () => __awaiter(this, void 0, void 0, function* () {
                const activeFile = 'xyz.py';
                const workspaceFolder = createMoqWorkspaceFolder(__dirname);
                setupActiveEditor(activeFile, constants_1.PYTHON_LANGUAGE);
                const defaultWorkspace = path.join('usr', 'desktop');
                setupWorkspaces([defaultWorkspace]);
                const port = 12341234;
                const debugConfig = yield debugProvider.resolveDebugConfiguration(workspaceFolder, { port, request: 'attach' });
                chai_1.expect(debugConfig).to.have.property('port', port);
            }));
            test('Ensure \'debugOptions\' are left unaltered', () => __awaiter(this, void 0, void 0, function* () {
                const activeFile = 'xyz.py';
                const workspaceFolder = createMoqWorkspaceFolder(__dirname);
                setupActiveEditor(activeFile, constants_1.PYTHON_LANGUAGE);
                const defaultWorkspace = path.join('usr', 'desktop');
                setupWorkspaces([defaultWorkspace]);
                const debugOptions = debugOptionsAvailable.slice().concat(types_3.DebugOptions.Jinja, types_3.DebugOptions.Sudo);
                const expectedDebugOptions = debugOptions.slice();
                const debugConfig = yield debugProvider.resolveDebugConfiguration(workspaceFolder, { debugOptions, request: 'attach' });
                chai_1.expect(debugConfig).to.have.property('debugOptions').to.be.deep.equal(expectedDebugOptions);
            }));
        });
    });
});
//# sourceMappingURL=provider.attach.unit.test.js.map