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
// tslint:disable:max-func-body-length
const chai_1 = require("chai");
const path = require("path");
const TypeMoq = require("typemoq");
const vscode_1 = require("vscode");
const types_1 = require("../../../client/common/platform/types");
const commandPrompt_1 = require("../../../client/common/terminal/environmentActivationProviders/commandPrompt");
const types_2 = require("../../../client/common/terminal/types");
const types_3 = require("../../../client/common/types");
const enum_1 = require("../../../client/common/utils/enum");
suite('Terminal Environment Activation (cmd/powershell)', () => {
    ['c:/programfiles/python/python', 'c:/program files/python/python',
        'c:\\users\\windows paths\\conda\\python.exe'].forEach(pythonPath => {
        const hasSpaces = pythonPath.indexOf(' ') > 0;
        const resource = vscode_1.Uri.file('a');
        const suiteTitle = hasSpaces ? 'and there are spaces in the script file (pythonpath),' : 'and there are no spaces in the script file (pythonpath),';
        suite(suiteTitle, () => {
            ['activate', 'activate.sh', 'activate.csh', 'activate.fish', 'activate.bat', 'activate.ps1'].forEach(scriptFileName => {
                suite(`and script file is ${scriptFileName}`, () => {
                    let serviceContainer;
                    let fileSystem;
                    setup(() => {
                        serviceContainer = TypeMoq.Mock.ofType();
                        fileSystem = TypeMoq.Mock.ofType();
                        serviceContainer.setup(c => c.get(types_1.IFileSystem)).returns(() => fileSystem.object);
                        const configService = TypeMoq.Mock.ofType();
                        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_3.IConfigurationService))).returns(() => configService.object);
                        const settings = TypeMoq.Mock.ofType();
                        settings.setup(s => s.pythonPath).returns(() => pythonPath);
                        configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);
                    });
                    enum_1.getNamesAndValues(types_2.TerminalShellType).forEach(shellType => {
                        const isScriptFileSupported = ['activate.bat', 'activate.ps1'].indexOf(scriptFileName) >= 0;
                        const titleTitle = isScriptFileSupported ? `Ensure terminal type is supported (Shell: ${shellType.name})` :
                            `Ensure terminal type is not supported (Shell: ${shellType.name})`;
                        test(titleTitle, () => __awaiter(this, void 0, void 0, function* () {
                            const bash = new commandPrompt_1.CommandPromptAndPowerShell(serviceContainer.object);
                            const supported = bash.isShellSupported(shellType.value);
                            switch (shellType.value) {
                                case types_2.TerminalShellType.commandPrompt:
                                case types_2.TerminalShellType.powershellCore:
                                case types_2.TerminalShellType.powershell: {
                                    chai_1.expect(supported).to.be.equal(true, `${shellType.name} shell not supported (it should be)`);
                                    break;
                                }
                                default: {
                                    chai_1.expect(supported).to.be.equal(false, `${shellType.name} incorrectly supported (should not be)`);
                                }
                            }
                        }));
                    });
                });
            });
            suite('and script file is activate.bat', () => {
                let serviceContainer;
                let fileSystem;
                let platform;
                setup(() => {
                    serviceContainer = TypeMoq.Mock.ofType();
                    fileSystem = TypeMoq.Mock.ofType();
                    platform = TypeMoq.Mock.ofType();
                    serviceContainer.setup(c => c.get(types_1.IFileSystem)).returns(() => fileSystem.object);
                    serviceContainer.setup(c => c.get(types_1.IPlatformService)).returns(() => platform.object);
                    const configService = TypeMoq.Mock.ofType();
                    serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_3.IConfigurationService))).returns(() => configService.object);
                    const settings = TypeMoq.Mock.ofType();
                    settings.setup(s => s.pythonPath).returns(() => pythonPath);
                    configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);
                });
                test('Ensure batch files are supported by command prompt', () => __awaiter(this, void 0, void 0, function* () {
                    const bash = new commandPrompt_1.CommandPromptAndPowerShell(serviceContainer.object);
                    const pathToScriptFile = path.join(path.dirname(pythonPath), 'activate.bat');
                    fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(pathToScriptFile))).returns(() => Promise.resolve(true));
                    const commands = yield bash.getActivationCommands(resource, types_2.TerminalShellType.commandPrompt);
                    // Ensure the script file is of the following form:
                    // source "<path to script file>" <environment name>
                    // Ensure the path is quoted if it contains any spaces.
                    // Ensure it contains the name of the environment as an argument to the script file.
                    chai_1.expect(commands).to.be.deep.equal([pathToScriptFile.fileToCommandArgument()], 'Invalid command');
                }));
                test('Ensure batch files are not supported by powershell (on windows)', () => __awaiter(this, void 0, void 0, function* () {
                    const batch = new commandPrompt_1.CommandPromptAndPowerShell(serviceContainer.object);
                    platform.setup(p => p.isWindows).returns(() => true);
                    const pathToScriptFile = path.join(path.dirname(pythonPath), 'activate.bat');
                    fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(pathToScriptFile))).returns(() => Promise.resolve(true));
                    const command = yield batch.getActivationCommands(resource, types_2.TerminalShellType.powershell);
                    chai_1.expect(command).to.be.equal(undefined, 'Invalid');
                }));
                test('Ensure batch files are not supported by powershell core (on windows)', () => __awaiter(this, void 0, void 0, function* () {
                    const bash = new commandPrompt_1.CommandPromptAndPowerShell(serviceContainer.object);
                    platform.setup(p => p.isWindows).returns(() => true);
                    const pathToScriptFile = path.join(path.dirname(pythonPath), 'activate.bat');
                    fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(pathToScriptFile))).returns(() => Promise.resolve(true));
                    const command = yield bash.getActivationCommands(resource, types_2.TerminalShellType.powershellCore);
                    chai_1.expect(command).to.be.equal(undefined, 'Invalid');
                }));
                test('Ensure batch files are not supported by powershell (on non-windows)', () => __awaiter(this, void 0, void 0, function* () {
                    const bash = new commandPrompt_1.CommandPromptAndPowerShell(serviceContainer.object);
                    platform.setup(p => p.isWindows).returns(() => false);
                    const pathToScriptFile = path.join(path.dirname(pythonPath), 'activate.bat');
                    fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(pathToScriptFile))).returns(() => Promise.resolve(true));
                    const command = yield bash.getActivationCommands(resource, types_2.TerminalShellType.powershell);
                    chai_1.expect(command).to.be.equal(undefined, 'Invalid command');
                }));
                test('Ensure batch files are not supported by powershell core (on non-windows)', () => __awaiter(this, void 0, void 0, function* () {
                    const bash = new commandPrompt_1.CommandPromptAndPowerShell(serviceContainer.object);
                    platform.setup(p => p.isWindows).returns(() => false);
                    const pathToScriptFile = path.join(path.dirname(pythonPath), 'activate.bat');
                    fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(pathToScriptFile))).returns(() => Promise.resolve(true));
                    const command = yield bash.getActivationCommands(resource, types_2.TerminalShellType.powershellCore);
                    chai_1.expect(command).to.be.equal(undefined, 'Invalid command');
                }));
            });
            suite('and script file is activate.ps1', () => {
                let serviceContainer;
                let fileSystem;
                let platform;
                setup(() => {
                    serviceContainer = TypeMoq.Mock.ofType();
                    fileSystem = TypeMoq.Mock.ofType();
                    platform = TypeMoq.Mock.ofType();
                    serviceContainer.setup(c => c.get(types_1.IFileSystem)).returns(() => fileSystem.object);
                    serviceContainer.setup(c => c.get(types_1.IPlatformService)).returns(() => platform.object);
                    const configService = TypeMoq.Mock.ofType();
                    serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_3.IConfigurationService))).returns(() => configService.object);
                    const settings = TypeMoq.Mock.ofType();
                    settings.setup(s => s.pythonPath).returns(() => pythonPath);
                    configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);
                });
                test('Ensure powershell files are not supported by command prompt', () => __awaiter(this, void 0, void 0, function* () {
                    const bash = new commandPrompt_1.CommandPromptAndPowerShell(serviceContainer.object);
                    platform.setup(p => p.isWindows).returns(() => true);
                    const pathToScriptFile = path.join(path.dirname(pythonPath), 'activate.ps1');
                    fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(pathToScriptFile))).returns(() => Promise.resolve(true));
                    const command = yield bash.getActivationCommands(resource, types_2.TerminalShellType.commandPrompt);
                    chai_1.expect(command).to.be.deep.equal([], 'Invalid command (running powershell files are not supported on command prompt)');
                }));
                test('Ensure powershell files are supported by powershell', () => __awaiter(this, void 0, void 0, function* () {
                    const bash = new commandPrompt_1.CommandPromptAndPowerShell(serviceContainer.object);
                    platform.setup(p => p.isWindows).returns(() => true);
                    const pathToScriptFile = path.join(path.dirname(pythonPath), 'activate.ps1');
                    fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(pathToScriptFile))).returns(() => Promise.resolve(true));
                    const command = yield bash.getActivationCommands(resource, types_2.TerminalShellType.powershell);
                    chai_1.expect(command).to.be.deep.equal([`& ${pathToScriptFile.fileToCommandArgument()}`.trim()], 'Invalid command');
                }));
                test('Ensure powershell files are supported by powershell core', () => __awaiter(this, void 0, void 0, function* () {
                    const bash = new commandPrompt_1.CommandPromptAndPowerShell(serviceContainer.object);
                    platform.setup(p => p.isWindows).returns(() => true);
                    const pathToScriptFile = path.join(path.dirname(pythonPath), 'activate.ps1');
                    fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(pathToScriptFile))).returns(() => Promise.resolve(true));
                    const command = yield bash.getActivationCommands(resource, types_2.TerminalShellType.powershellCore);
                    chai_1.expect(command).to.be.deep.equal([`& ${pathToScriptFile.fileToCommandArgument()}`.trim()], 'Invalid command');
                }));
            });
        });
    });
});
//# sourceMappingURL=activation.commandPrompt.unit.test.js.map