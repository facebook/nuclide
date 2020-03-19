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
const TypeMoq = require("typemoq");
require("../../../client/common/extensions");
const types_1 = require("../../../client/common/platform/types");
const bash_1 = require("../../../client/common/terminal/environmentActivationProviders/bash");
const types_2 = require("../../../client/common/terminal/types");
const types_3 = require("../../../client/common/types");
const enum_1 = require("../../../client/common/utils/enum");
// tslint:disable-next-line:max-func-body-length
suite('Terminal Environment Activation (bash)', () => {
    ['usr/bin/python', 'usr/bin/env with spaces/env more/python', 'c:\\users\\windows paths\\conda\\python.exe'].forEach(pythonPath => {
        const hasSpaces = pythonPath.indexOf(' ') > 0;
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
                        let isScriptFileSupported = false;
                        switch (shellType.value) {
                            case types_2.TerminalShellType.zsh:
                            case types_2.TerminalShellType.ksh:
                            case types_2.TerminalShellType.wsl:
                            case types_2.TerminalShellType.gitbash:
                            case types_2.TerminalShellType.bash: {
                                isScriptFileSupported = ['activate', 'activate.sh'].indexOf(scriptFileName) >= 0;
                                break;
                            }
                            case types_2.TerminalShellType.fish: {
                                isScriptFileSupported = ['activate.fish'].indexOf(scriptFileName) >= 0;
                                break;
                            }
                            case types_2.TerminalShellType.tcshell:
                            case types_2.TerminalShellType.cshell: {
                                isScriptFileSupported = ['activate.csh'].indexOf(scriptFileName) >= 0;
                                break;
                            }
                            default: {
                                isScriptFileSupported = false;
                            }
                        }
                        const titleTitle = isScriptFileSupported ? `Ensure bash Activation command returns activation command (Shell: ${shellType.name})` :
                            `Ensure bash Activation command returns undefined (Shell: ${shellType.name})`;
                        test(titleTitle, () => __awaiter(this, void 0, void 0, function* () {
                            const bash = new bash_1.Bash(serviceContainer.object);
                            const supported = bash.isShellSupported(shellType.value);
                            switch (shellType.value) {
                                case types_2.TerminalShellType.wsl:
                                case types_2.TerminalShellType.zsh:
                                case types_2.TerminalShellType.ksh:
                                case types_2.TerminalShellType.bash:
                                case types_2.TerminalShellType.gitbash:
                                case types_2.TerminalShellType.tcshell:
                                case types_2.TerminalShellType.cshell:
                                case types_2.TerminalShellType.fish: {
                                    chai_1.expect(supported).to.be.equal(true, `${shellType.name} shell not supported (it should be)`);
                                    break;
                                }
                                default: {
                                    chai_1.expect(supported).to.be.equal(false, `${shellType.name} incorrectly supported (should not be)`);
                                    // No point proceeding with other tests.
                                    return;
                                }
                            }
                            const pathToScriptFile = path.join(path.dirname(pythonPath), scriptFileName);
                            fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(pathToScriptFile))).returns(() => Promise.resolve(true));
                            const command = yield bash.getActivationCommands(undefined, shellType.value);
                            if (isScriptFileSupported) {
                                // Ensure the script file is of the following form:
                                // source "<path to script file>" <environment name>
                                // Ensure the path is quoted if it contains any spaces.
                                // Ensure it contains the name of the environment as an argument to the script file.
                                chai_1.expect(command).to.be.deep.equal([`source ${pathToScriptFile.fileToCommandArgument()}`.trim()], 'Invalid command');
                            }
                            else {
                                chai_1.expect(command).to.be.equal(undefined, 'Command should be undefined');
                            }
                        }));
                    });
                });
            });
        });
    });
});
//# sourceMappingURL=activation.bash.unit.test.js.map