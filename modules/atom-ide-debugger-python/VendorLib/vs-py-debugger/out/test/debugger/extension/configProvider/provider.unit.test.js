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
// tslint:disable:max-func-body-length no-invalid-template-strings no-any no-object-literal-type-assertion
const chai_1 = require("chai");
const path = require("path");
const TypeMoq = require("typemoq");
const vscode_1 = require("vscode");
const invalidPythonPathInDebugger_1 = require("../../../../client/application/diagnostics/checks/invalidPythonPathInDebugger");
const types_1 = require("../../../../client/application/diagnostics/types");
const types_2 = require("../../../../client/common/application/types");
const constants_1 = require("../../../../client/common/constants");
const types_3 = require("../../../../client/common/platform/types");
const types_4 = require("../../../../client/common/process/types");
const types_5 = require("../../../../client/common/types");
const constants_2 = require("../../../../client/debugger/constants");
const configurationProviderUtils_1 = require("../../../../client/debugger/extension/configProviders/configurationProviderUtils");
const pythonV2Provider_1 = require("../../../../client/debugger/extension/configProviders/pythonV2Provider");
const types_6 = require("../../../../client/debugger/extension/configProviders/types");
const types_7 = require("../../../../client/debugger/types");
const contracts_1 = require("../../../../client/interpreter/contracts");
suite('Debugging - Config Provider', () => {
    let serviceContainer;
    let debugProvider;
    let platformService;
    let fileSystem;
    let appShell;
    let pythonExecutionService;
    let logger;
    let helper;
    let diagnosticsService;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType();
        debugProvider = new pythonV2Provider_1.PythonV2DebugConfigurationProvider(serviceContainer.object);
    });
    function createMoqWorkspaceFolder(folderPath) {
        const folder = TypeMoq.Mock.ofType();
        folder.setup(f => f.uri).returns(() => vscode_1.Uri.file(folderPath));
        return folder.object;
    }
    function setupIoc(pythonPath, isWindows = false, isMac = false, isLinux = false) {
        const confgService = TypeMoq.Mock.ofType();
        platformService = TypeMoq.Mock.ofType();
        fileSystem = TypeMoq.Mock.ofType();
        appShell = TypeMoq.Mock.ofType();
        logger = TypeMoq.Mock.ofType();
        diagnosticsService = TypeMoq.Mock.ofType();
        pythonExecutionService = TypeMoq.Mock.ofType();
        helper = TypeMoq.Mock.ofType();
        pythonExecutionService.setup((x) => x.then).returns(() => undefined);
        const factory = TypeMoq.Mock.ofType();
        factory.setup(f => f.create(TypeMoq.It.isAny())).returns(() => Promise.resolve(pythonExecutionService.object));
        helper.setup(h => h.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({}));
        diagnosticsService
            .setup(h => h.validatePythonPath(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(true));
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_4.IPythonExecutionFactory))).returns(() => factory.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_5.IConfigurationService))).returns(() => confgService.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_3.IPlatformService))).returns(() => platformService.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_3.IFileSystem))).returns(() => fileSystem.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_2.IApplicationShell))).returns(() => appShell.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_6.IConfigurationProviderUtils))).returns(() => new configurationProviderUtils_1.ConfigurationProviderUtils(serviceContainer.object));
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_5.ILogger))).returns(() => logger.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(contracts_1.IInterpreterHelper))).returns(() => helper.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.IDiagnosticsService), TypeMoq.It.isValue(invalidPythonPathInDebugger_1.InvalidPythonPathInDebuggerServiceId))).returns(() => diagnosticsService.object);
        const settings = TypeMoq.Mock.ofType();
        settings.setup(s => s.pythonPath).returns(() => pythonPath);
        confgService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);
        setupOs(isWindows, isMac, isLinux);
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
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_2.IDocumentManager))).returns(() => documentManager.object);
    }
    function setupWorkspaces(folders) {
        const workspaceService = TypeMoq.Mock.ofType();
        const workspaceFolders = folders.map(createMoqWorkspaceFolder);
        workspaceService.setup(w => w.workspaceFolders).returns(() => workspaceFolders);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_2.IWorkspaceService))).returns(() => workspaceService.object);
    }
    function setupOs(isWindows, isMac, isLinux) {
        platformService.setup(p => p.isWindows).returns(() => isWindows);
        platformService.setup(p => p.isMac).returns(() => isMac);
        platformService.setup(p => p.isLinux).returns(() => isLinux);
    }
    test('Defaults should be returned when an empty object is passed with a Workspace Folder and active file', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = `PythonPath_${new Date().toString()}`;
        const workspaceFolder = createMoqWorkspaceFolder(__dirname);
        const pythonFile = 'xyz.py';
        setupIoc(pythonPath);
        setupActiveEditor(pythonFile, constants_1.PYTHON_LANGUAGE);
        const debugConfig = yield debugProvider.resolveDebugConfiguration(workspaceFolder, {});
        chai_1.expect(Object.keys(debugConfig)).to.have.lengthOf.above(3);
        chai_1.expect(debugConfig).to.have.property('pythonPath', pythonPath);
        chai_1.expect(debugConfig).to.have.property('type', 'python');
        chai_1.expect(debugConfig).to.have.property('request', 'launch');
        chai_1.expect(debugConfig).to.have.property('program', pythonFile);
        chai_1.expect(debugConfig).to.have.property('cwd');
        chai_1.expect(debugConfig.cwd.toLowerCase()).to.be.equal(__dirname.toLowerCase());
        chai_1.expect(debugConfig).to.have.property('envFile');
        chai_1.expect(debugConfig.envFile.toLowerCase()).to.be.equal(path.join(__dirname, '.env').toLowerCase());
        chai_1.expect(debugConfig).to.have.property('env');
        // tslint:disable-next-line:no-any
        chai_1.expect(Object.keys(debugConfig.env)).to.have.lengthOf(0);
    }));
    test('Defaults should be returned when an object with \'noDebug\' property is passed with a Workspace Folder and active file', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = `PythonPath_${new Date().toString()}`;
        const workspaceFolder = createMoqWorkspaceFolder(__dirname);
        const pythonFile = 'xyz.py';
        setupIoc(pythonPath);
        setupActiveEditor(pythonFile, constants_1.PYTHON_LANGUAGE);
        const debugConfig = yield debugProvider.resolveDebugConfiguration(workspaceFolder, { noDebug: true });
        chai_1.expect(Object.keys(debugConfig)).to.have.lengthOf.above(3);
        chai_1.expect(debugConfig).to.have.property('pythonPath', pythonPath);
        chai_1.expect(debugConfig).to.have.property('type', 'python');
        chai_1.expect(debugConfig).to.have.property('request', 'launch');
        chai_1.expect(debugConfig).to.have.property('program', pythonFile);
        chai_1.expect(debugConfig).to.have.property('cwd');
        chai_1.expect(debugConfig.cwd.toLowerCase()).to.be.equal(__dirname.toLowerCase());
        chai_1.expect(debugConfig).to.have.property('envFile');
        chai_1.expect(debugConfig.envFile.toLowerCase()).to.be.equal(path.join(__dirname, '.env').toLowerCase());
        chai_1.expect(debugConfig).to.have.property('env');
        // tslint:disable-next-line:no-any
        chai_1.expect(Object.keys(debugConfig.env)).to.have.lengthOf(0);
    }));
    test('Defaults should be returned when an empty object is passed without Workspace Folder, no workspaces and active file', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = `PythonPath_${new Date().toString()}`;
        const pythonFile = 'xyz.py';
        setupIoc(pythonPath);
        setupActiveEditor(pythonFile, constants_1.PYTHON_LANGUAGE);
        setupWorkspaces([]);
        const debugConfig = yield debugProvider.resolveDebugConfiguration(undefined, {});
        const filePath = vscode_1.Uri.file(path.dirname('')).fsPath;
        chai_1.expect(Object.keys(debugConfig)).to.have.lengthOf.above(3);
        chai_1.expect(debugConfig).to.have.property('pythonPath', pythonPath);
        chai_1.expect(debugConfig).to.have.property('type', 'python');
        chai_1.expect(debugConfig).to.have.property('request', 'launch');
        chai_1.expect(debugConfig).to.have.property('program', pythonFile);
        chai_1.expect(debugConfig).to.have.property('cwd');
        chai_1.expect(debugConfig.cwd.toLowerCase()).to.be.equal(filePath.toLowerCase());
        chai_1.expect(debugConfig).to.have.property('envFile');
        chai_1.expect(debugConfig.envFile.toLowerCase()).to.be.equal(path.join(filePath, '.env').toLowerCase());
        chai_1.expect(debugConfig).to.have.property('env');
        // tslint:disable-next-line:no-any
        chai_1.expect(Object.keys(debugConfig.env)).to.have.lengthOf(0);
    }));
    test('Defaults should be returned when an empty object is passed without Workspace Folder, no workspaces and no active file', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = `PythonPath_${new Date().toString()}`;
        setupIoc(pythonPath);
        setupActiveEditor(undefined, constants_1.PYTHON_LANGUAGE);
        setupWorkspaces([]);
        const debugConfig = yield debugProvider.resolveDebugConfiguration(undefined, {});
        chai_1.expect(Object.keys(debugConfig)).to.have.lengthOf.above(3);
        chai_1.expect(debugConfig).to.have.property('pythonPath', pythonPath);
        chai_1.expect(debugConfig).to.have.property('type', 'python');
        chai_1.expect(debugConfig).to.have.property('request', 'launch');
        chai_1.expect(debugConfig).to.have.property('program', '');
        chai_1.expect(debugConfig).not.to.have.property('cwd');
        chai_1.expect(debugConfig).not.to.have.property('envFile');
        chai_1.expect(debugConfig).to.have.property('env');
        // tslint:disable-next-line:no-any
        chai_1.expect(Object.keys(debugConfig.env)).to.have.lengthOf(0);
    }));
    test('Defaults should be returned when an empty object is passed without Workspace Folder, no workspaces and non python file', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = `PythonPath_${new Date().toString()}`;
        const activeFile = 'xyz.js';
        setupIoc(pythonPath);
        setupActiveEditor(activeFile, 'javascript');
        setupWorkspaces([]);
        const debugConfig = yield debugProvider.resolveDebugConfiguration(undefined, {});
        chai_1.expect(Object.keys(debugConfig)).to.have.lengthOf.above(3);
        chai_1.expect(debugConfig).to.have.property('pythonPath', pythonPath);
        chai_1.expect(debugConfig).to.have.property('type', 'python');
        chai_1.expect(debugConfig).to.have.property('request', 'launch');
        chai_1.expect(debugConfig).to.have.property('program', '');
        chai_1.expect(debugConfig).not.to.have.property('cwd');
        chai_1.expect(debugConfig).not.to.have.property('envFile');
        chai_1.expect(debugConfig).to.have.property('env');
        // tslint:disable-next-line:no-any
        chai_1.expect(Object.keys(debugConfig.env)).to.have.lengthOf(0);
    }));
    test('Defaults should be returned when an empty object is passed without Workspace Folder, with a workspace and an active python file', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = `PythonPath_${new Date().toString()}`;
        const activeFile = 'xyz.py';
        setupIoc(pythonPath);
        setupActiveEditor(activeFile, constants_1.PYTHON_LANGUAGE);
        const defaultWorkspace = path.join('usr', 'desktop');
        setupWorkspaces([defaultWorkspace]);
        const debugConfig = yield debugProvider.resolveDebugConfiguration(undefined, {});
        const filePath = vscode_1.Uri.file(defaultWorkspace).fsPath;
        chai_1.expect(Object.keys(debugConfig)).to.have.lengthOf.above(3);
        chai_1.expect(debugConfig).to.have.property('pythonPath', pythonPath);
        chai_1.expect(debugConfig).to.have.property('type', 'python');
        chai_1.expect(debugConfig).to.have.property('request', 'launch');
        chai_1.expect(debugConfig).to.have.property('program', activeFile);
        chai_1.expect(debugConfig).to.have.property('cwd');
        chai_1.expect(debugConfig.cwd.toLowerCase()).to.be.equal(filePath.toLowerCase());
        chai_1.expect(debugConfig).to.have.property('envFile');
        chai_1.expect(debugConfig.envFile.toLowerCase()).to.be.equal(path.join(filePath, '.env').toLowerCase());
        chai_1.expect(debugConfig).to.have.property('env');
        // tslint:disable-next-line:no-any
        chai_1.expect(Object.keys(debugConfig.env)).to.have.lengthOf(0);
    }));
    test('Ensure `${config:python.pythonPath}` is replaced with actual pythonPath', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = `PythonPath_${new Date().toString()}`;
        const activeFile = 'xyz.py';
        const workspaceFolder = createMoqWorkspaceFolder(__dirname);
        setupIoc(pythonPath);
        setupActiveEditor(activeFile, constants_1.PYTHON_LANGUAGE);
        const defaultWorkspace = path.join('usr', 'desktop');
        setupWorkspaces([defaultWorkspace]);
        const debugConfig = yield debugProvider.resolveDebugConfiguration(workspaceFolder, { pythonPath: '${config:python.pythonPath}' });
        chai_1.expect(debugConfig).to.have.property('pythonPath', pythonPath);
    }));
    test('Ensure hardcoded pythonPath is left unaltered', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = `PythonPath_${new Date().toString()}`;
        const activeFile = 'xyz.py';
        const workspaceFolder = createMoqWorkspaceFolder(__dirname);
        setupIoc(pythonPath);
        setupActiveEditor(activeFile, constants_1.PYTHON_LANGUAGE);
        const defaultWorkspace = path.join('usr', 'desktop');
        setupWorkspaces([defaultWorkspace]);
        const debugPythonPath = `Debug_PythonPath_${new Date().toString()}`;
        const debugConfig = yield debugProvider.resolveDebugConfiguration(workspaceFolder, { pythonPath: debugPythonPath });
        chai_1.expect(debugConfig).to.have.property('pythonPath', debugPythonPath);
    }));
    test('Test defaults of debugger', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = `PythonPath_${new Date().toString()}`;
        const workspaceFolder = createMoqWorkspaceFolder(__dirname);
        const pythonFile = 'xyz.py';
        setupIoc(pythonPath);
        setupActiveEditor(pythonFile, constants_1.PYTHON_LANGUAGE);
        const debugConfig = yield debugProvider.resolveDebugConfiguration(workspaceFolder, {});
        chai_1.expect(debugConfig).to.have.property('console', 'integratedTerminal');
        chai_1.expect(debugConfig).to.have.property('stopOnEntry', false);
        chai_1.expect(debugConfig).to.have.property('showReturnValue', false);
        chai_1.expect(debugConfig).to.have.property('debugOptions');
        chai_1.expect(debugConfig.debugOptions).to.be.deep.equal([types_7.DebugOptions.RedirectOutput]);
    }));
    test('Test defaults of python debugger', () => __awaiter(this, void 0, void 0, function* () {
        if ('python' === constants_2.DebuggerTypeName) {
            return;
        }
        const pythonPath = `PythonPath_${new Date().toString()}`;
        const workspaceFolder = createMoqWorkspaceFolder(__dirname);
        const pythonFile = 'xyz.py';
        setupIoc(pythonPath);
        setupActiveEditor(pythonFile, constants_1.PYTHON_LANGUAGE);
        const debugConfig = yield debugProvider.resolveDebugConfiguration(workspaceFolder, {});
        chai_1.expect(debugConfig).to.have.property('stopOnEntry', false);
        chai_1.expect(debugConfig).to.have.property('showReturnValue', false);
        chai_1.expect(debugConfig).to.have.property('debugOptions');
        chai_1.expect(debugConfig.debugOptions).to.be.deep.equal([types_7.DebugOptions.RedirectOutput]);
    }));
    test('Test overriding defaults of debugger', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = `PythonPath_${new Date().toString()}`;
        const workspaceFolder = createMoqWorkspaceFolder(__dirname);
        const pythonFile = 'xyz.py';
        setupIoc(pythonPath);
        setupActiveEditor(pythonFile, constants_1.PYTHON_LANGUAGE);
        const debugConfig = yield debugProvider.resolveDebugConfiguration(workspaceFolder, { redirectOutput: false });
        chai_1.expect(debugConfig).to.have.property('console', 'integratedTerminal');
        chai_1.expect(debugConfig).to.have.property('stopOnEntry', false);
        chai_1.expect(debugConfig).to.have.property('showReturnValue', false);
        chai_1.expect(debugConfig).to.have.property('debugOptions');
        chai_1.expect(debugConfig.debugOptions).to.be.deep.equal([]);
    }));
    function testFixFilePathCase(isWindows, isMac, isLinux) {
        return __awaiter(this, void 0, void 0, function* () {
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            const pythonFile = 'xyz.py';
            setupIoc(pythonPath, isWindows, isMac, isLinux);
            setupActiveEditor(pythonFile, constants_1.PYTHON_LANGUAGE);
            const debugConfig = yield debugProvider.resolveDebugConfiguration(workspaceFolder, {});
            if (isWindows) {
                chai_1.expect(debugConfig).to.have.property('debugOptions').contains(types_7.DebugOptions.FixFilePathCase);
            }
            else {
                chai_1.expect(debugConfig).to.have.property('debugOptions').not.contains(types_7.DebugOptions.FixFilePathCase);
            }
        });
    }
    test('Test fixFilePathCase for Windows', () => __awaiter(this, void 0, void 0, function* () {
        yield testFixFilePathCase(true, false, false);
    }));
    test('Test fixFilePathCase for Linux', () => __awaiter(this, void 0, void 0, function* () {
        yield testFixFilePathCase(false, false, true);
    }));
    test('Test fixFilePathCase for Mac', () => __awaiter(this, void 0, void 0, function* () {
        yield testFixFilePathCase(false, true, false);
    }));
    function testPyramidConfiguration(isWindows, isLinux, isMac, addPyramidDebugOption = true, pyramidExists = true, shouldWork = true) {
        return __awaiter(this, void 0, void 0, function* () {
            const workspacePath = path.join('usr', 'development', 'wksp1');
            const pythonPath = path.join(workspacePath, 'env', 'bin', 'python');
            const pyramidFilePath = path.join(path.dirname(pythonPath), 'lib', 'site_packages', 'pyramid', '__init__.py');
            const pserveFilePath = path.join(path.dirname(pyramidFilePath), 'scripts', 'pserve.py');
            const args = ['-c', 'import pyramid;print(pyramid.__file__)'];
            const workspaceFolder = createMoqWorkspaceFolder(workspacePath);
            const pythonFile = 'xyz.py';
            setupIoc(pythonPath, isWindows, isMac, isLinux);
            setupActiveEditor(pythonFile, constants_1.PYTHON_LANGUAGE);
            if (pyramidExists) {
                pythonExecutionService.setup(e => e.exec(TypeMoq.It.isValue(args), TypeMoq.It.isAny()))
                    .returns(() => Promise.resolve({ stdout: pyramidFilePath }))
                    .verifiable(TypeMoq.Times.exactly(addPyramidDebugOption ? 1 : 0));
            }
            else {
                pythonExecutionService.setup(e => e.exec(TypeMoq.It.isValue(args), TypeMoq.It.isAny()))
                    .returns(() => Promise.reject('No Module Available'))
                    .verifiable(TypeMoq.Times.exactly(addPyramidDebugOption ? 1 : 0));
            }
            fileSystem.setup(f => f.fileExists(TypeMoq.It.isValue(pserveFilePath)))
                .returns(() => Promise.resolve(pyramidExists))
                .verifiable(TypeMoq.Times.exactly(pyramidExists && addPyramidDebugOption ? 1 : 0));
            appShell.setup(a => a.showErrorMessage(TypeMoq.It.isAny()))
                .verifiable(TypeMoq.Times.exactly(pyramidExists || !addPyramidDebugOption ? 0 : 1));
            logger.setup(a => a.logError(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .verifiable(TypeMoq.Times.exactly(pyramidExists || !addPyramidDebugOption ? 0 : 1));
            const options = addPyramidDebugOption ? { debugOptions: [types_7.DebugOptions.Pyramid], pyramid: true } : {};
            const debugConfig = yield debugProvider.resolveDebugConfiguration(workspaceFolder, options);
            if (shouldWork) {
                chai_1.expect(debugConfig).to.have.property('program', pserveFilePath);
                chai_1.expect(debugConfig).to.have.property('debugOptions');
                chai_1.expect(debugConfig.debugOptions).contains(types_7.DebugOptions.Jinja);
            }
            else {
                chai_1.expect(debugConfig.program).to.be.not.equal(pserveFilePath);
            }
            pythonExecutionService.verifyAll();
            fileSystem.verifyAll();
            appShell.verifyAll();
            logger.verifyAll();
        });
    }
    test('Program is set for Pyramid (windows)', () => __awaiter(this, void 0, void 0, function* () {
        yield testPyramidConfiguration(true, false, false);
    }));
    test('Program is set for Pyramid (Linux)', () => __awaiter(this, void 0, void 0, function* () {
        yield testPyramidConfiguration(false, true, false);
    }));
    test('Program is set for Pyramid (Mac)', () => __awaiter(this, void 0, void 0, function* () {
        yield testPyramidConfiguration(false, false, true);
    }));
    test('Program is not set for Pyramid when DebugOption is not set (windows)', () => __awaiter(this, void 0, void 0, function* () {
        yield testPyramidConfiguration(true, false, false, false, false, false);
    }));
    test('Program is not set for Pyramid when DebugOption is not set (Linux)', () => __awaiter(this, void 0, void 0, function* () {
        yield testPyramidConfiguration(false, true, false, false, false, false);
    }));
    test('Program is not set for Pyramid when DebugOption is not set (Mac)', () => __awaiter(this, void 0, void 0, function* () {
        yield testPyramidConfiguration(false, false, true, false, false, false);
    }));
    test('Message is displayed when pyramid script does not exist (windows)', () => __awaiter(this, void 0, void 0, function* () {
        yield testPyramidConfiguration(true, false, false, true, false, false);
    }));
    test('Message is displayed when pyramid script does not exist (Linux)', () => __awaiter(this, void 0, void 0, function* () {
        yield testPyramidConfiguration(false, true, false, true, false, false);
    }));
    test('Message is displayed when pyramid script does not exist (Mac)', () => __awaiter(this, void 0, void 0, function* () {
        yield testPyramidConfiguration(false, false, true, true, false, false);
    }));
    test('Auto detect flask debugging', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = `PythonPath_${new Date().toString()}`;
        const workspaceFolder = createMoqWorkspaceFolder(__dirname);
        const pythonFile = 'xyz.py';
        setupIoc(pythonPath);
        setupActiveEditor(pythonFile, constants_1.PYTHON_LANGUAGE);
        const debugConfig = yield debugProvider.resolveDebugConfiguration(workspaceFolder, { module: 'flask' });
        chai_1.expect(debugConfig).to.have.property('debugOptions');
        chai_1.expect(debugConfig.debugOptions).contains(types_7.DebugOptions.RedirectOutput);
        chai_1.expect(debugConfig.debugOptions).contains(types_7.DebugOptions.Jinja);
    }));
    test('Test validation of Python Path when launching debugger (with invalid python path)', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = `PythonPath_${new Date().toString()}`;
        const workspaceFolder = createMoqWorkspaceFolder(__dirname);
        const pythonFile = 'xyz.py';
        setupIoc(pythonPath);
        setupActiveEditor(pythonFile, constants_1.PYTHON_LANGUAGE);
        diagnosticsService.reset();
        diagnosticsService
            .setup(h => h.validatePythonPath(TypeMoq.It.isValue(pythonPath), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(false))
            .verifiable(TypeMoq.Times.once());
        const debugConfig = yield debugProvider.resolveDebugConfiguration(workspaceFolder, { redirectOutput: false, pythonPath });
        diagnosticsService.verifyAll();
        chai_1.expect(debugConfig).to.be.equal(undefined, 'Not undefined');
    }));
    test('Test validation of Python Path when launching debugger (with valid python path)', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = `PythonPath_${new Date().toString()}`;
        const workspaceFolder = createMoqWorkspaceFolder(__dirname);
        const pythonFile = 'xyz.py';
        setupIoc(pythonPath);
        setupActiveEditor(pythonFile, constants_1.PYTHON_LANGUAGE);
        diagnosticsService.reset();
        diagnosticsService
            .setup(h => h.validatePythonPath(TypeMoq.It.isValue(pythonPath), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());
        const debugConfig = yield debugProvider.resolveDebugConfiguration(workspaceFolder, { redirectOutput: false, pythonPath });
        diagnosticsService.verifyAll();
        chai_1.expect(debugConfig).to.not.be.equal(undefined, 'is undefined');
    }));
    function testSetting(requestType, settings, debugOptionName, mustHaveDebugOption) {
        return __awaiter(this, void 0, void 0, function* () {
            setupIoc('pythonPath');
            const debugConfiguration = Object.assign({ request: requestType, type: 'python', name: '' }, settings);
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            const debugConfig = yield debugProvider.resolveDebugConfiguration(workspaceFolder, debugConfiguration);
            if (mustHaveDebugOption) {
                chai_1.expect(debugConfig.debugOptions).contains(debugOptionName);
            }
            else {
                chai_1.expect(debugConfig.debugOptions).not.contains(debugOptionName);
            }
        });
    }
    const items = ['launch', 'attach'];
    items.forEach(requestType => {
        test(`Must not contain Sub Process when not specified (${requestType})`, () => __awaiter(this, void 0, void 0, function* () {
            yield testSetting(requestType, {}, types_7.DebugOptions.SubProcess, false);
        }));
        test(`Must not contain Sub Process setting=false (${requestType})`, () => __awaiter(this, void 0, void 0, function* () {
            yield testSetting(requestType, { subProcess: false }, types_7.DebugOptions.SubProcess, false);
        }));
        test(`Must not contain Sub Process setting=true (${requestType})`, () => __awaiter(this, void 0, void 0, function* () {
            yield testSetting(requestType, { subProcess: true }, types_7.DebugOptions.SubProcess, true);
        }));
    });
});
//# sourceMappingURL=provider.unit.test.js.map