"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const path = require("path");
const vscode_debugadapter_1 = require("vscode-debugadapter");
const open_1 = require("../../../common/open");
const pathUtils_1 = require("../../../common/platform/pathUtils");
const currentProcess_1 = require("../../../common/process/currentProcess");
const misc_1 = require("../../../common/utils/misc");
const environment_1 = require("../../../common/variables/environment");
const types_1 = require("../../types");
const Utils_1 = require("../Common/Utils");
const LocalDebugServerV2_1 = require("../DebugServers/LocalDebugServerV2");
const DebugClient_1 = require("./DebugClient");
const helper_1 = require("./helper");
const VALID_DEBUG_OPTIONS = [
    'RedirectOutput',
    'DebugStdLib',
    'StopOnEntry',
    'ShowReturnValue',
    'BreakOnSystemExitZero',
    'DjangoDebugging',
    'Django'
];
var DebugServerStatus;
(function (DebugServerStatus) {
    DebugServerStatus[DebugServerStatus["Unknown"] = 1] = "Unknown";
    DebugServerStatus[DebugServerStatus["Running"] = 2] = "Running";
    DebugServerStatus[DebugServerStatus["NotRunning"] = 3] = "NotRunning";
})(DebugServerStatus || (DebugServerStatus = {}));
class LocalDebugClient extends DebugClient_1.DebugClient {
    constructor(args, debugSession, canLaunchTerminal, launcherScriptProvider) {
        super(args, debugSession);
        this.canLaunchTerminal = canLaunchTerminal;
        this.launcherScriptProvider = launcherScriptProvider;
    }
    get debugServerStatus() {
        if (this.debugServer && this.debugServer.IsRunning) {
            return DebugServerStatus.Running;
        }
        if (this.debugServer && !this.debugServer.IsRunning) {
            return DebugServerStatus.NotRunning;
        }
        return DebugServerStatus.Unknown;
    }
    CreateDebugServer(serviceContainer) {
        this.debugServer = new LocalDebugServerV2_1.LocalDebugServerV2(this.debugSession, this.args, serviceContainer);
        return this.debugServer;
    }
    get DebugType() {
        return DebugClient_1.DebugType.Local;
    }
    Stop() {
        if (this.debugServer) {
            this.debugServer.Stop();
            this.debugServer = undefined;
        }
        if (this.pyProc) {
            this.pyProc.kill();
            this.pyProc = undefined;
        }
    }
    // tslint:disable-next-line:no-any
    displayError(error) {
        const errorMsg = typeof error === 'string' ? error : ((error.message && error.message.length > 0) ? error.message : '');
        if (errorMsg.length > 0) {
            this.debugSession.sendEvent(new vscode_debugadapter_1.OutputEvent(errorMsg, 'stderr'));
        }
    }
    // tslint:disable-next-line:max-func-body-length member-ordering no-any
    LaunchApplicationToDebug(dbgServer) {
        return __awaiter(this, void 0, void 0, function* () {
            const pathUtils = new pathUtils_1.PathUtils(Utils_1.IS_WINDOWS);
            const currentProcess = new currentProcess_1.CurrentProcess();
            const environmentVariablesService = new environment_1.EnvironmentVariablesService(pathUtils);
            const helper = new helper_1.DebugClientHelper(environmentVariablesService, pathUtils, currentProcess);
            const environmentVariables = yield helper.getEnvironmentVariables(this.args);
            // tslint:disable-next-line:max-func-body-length cyclomatic-complexity no-any
            return new Promise((resolve, reject) => {
                const fileDir = this.args && this.args.program ? path.dirname(this.args.program) : '';
                let processCwd = fileDir;
                if (typeof this.args.cwd === 'string' && this.args.cwd.length > 0 && this.args.cwd !== 'null') {
                    processCwd = this.args.cwd;
                }
                let pythonPath = 'python';
                if (typeof this.args.pythonPath === 'string' && this.args.pythonPath.trim().length > 0) {
                    pythonPath = this.args.pythonPath;
                }
                const args = this.buildLaunchArguments(processCwd, dbgServer.port);
                switch (this.args.console) {
                    case 'externalTerminal':
                    case 'integratedTerminal': {
                        const isSudo = Array.isArray(this.args.debugOptions) && this.args.debugOptions.some(opt => opt === 'Sudo');
                        this.launchExternalTerminal(isSudo, processCwd, pythonPath, args, environmentVariables).then(resolve).catch(reject);
                        break;
                    }
                    default: {
                        this.pyProc = child_process_1.spawn(pythonPath, args, { cwd: processCwd, env: environmentVariables });
                        this.handleProcessOutput(this.pyProc, reject);
                        // Here we wait for the application to connect to the socket server.
                        // Only once connected do we know that the application has successfully launched.
                        this.debugServer.DebugClientConnected
                            .then(resolve)
                            .catch(ex => console.error('Python Extension: debugServer.DebugClientConnected', ex));
                    }
                }
            });
        });
    }
    // tslint:disable-next-line:member-ordering
    handleProcessOutput(proc, failedToLaunch) {
        proc.on('error', error => {
            // If debug server has started, then don't display errors.
            // The debug adapter will get this info from the debugger (e.g. ptvsd lib).
            const status = this.debugServerStatus;
            if (status === DebugServerStatus.Running) {
                return;
            }
            if (status === DebugServerStatus.NotRunning && typeof (error) === 'object' && error !== null) {
                return failedToLaunch(error);
            }
            // This could happen when the debugger didn't launch at all, e.g. python doesn't exist.
            this.displayError(error);
        });
        proc.stderr.setEncoding('utf8');
        proc.stderr.on('data', misc_1.noop);
        proc.stdout.on('data', d => {
            // This is necessary so we read the stdout of the python process,
            // Else it just keep building up (related to issue #203 and #52).
            // tslint:disable-next-line:prefer-const no-unused-variable
            let x = 0;
        });
    }
    buildLaunchArguments(cwd, debugPort) {
        return [...this.buildDebugArguments(cwd, debugPort), ...this.buildStandardArguments()];
    }
    // tslint:disable-next-line:member-ordering
    buildDebugArguments(cwd, debugPort) {
        const ptVSToolsFilePath = this.launcherScriptProvider.getLauncherFilePath();
        const vsDebugOptions = [types_1.DebugOptions.RedirectOutput];
        if (Array.isArray(this.args.debugOptions)) {
            this.args.debugOptions.filter(opt => VALID_DEBUG_OPTIONS.indexOf(opt) >= 0)
                .forEach(item => vsDebugOptions.push(item));
        }
        const djangoIndex = vsDebugOptions.indexOf(types_1.DebugOptions.Django);
        // PTVSD expects the string `DjangoDebugging`
        if (djangoIndex >= 0) {
            vsDebugOptions[djangoIndex] = 'DjangoDebugging';
        }
        return [ptVSToolsFilePath, cwd, debugPort.toString(), '34806ad9-833a-4524-8cd6-18ca4aa74f14', vsDebugOptions.join(',')];
    }
    // tslint:disable-next-line:member-ordering
    buildStandardArguments() {
        const programArgs = Array.isArray(this.args.args) && this.args.args.length > 0 ? this.args.args : [];
        if (typeof this.args.module === 'string' && this.args.module.length > 0) {
            return ['-m', this.args.module, ...programArgs];
        }
        if (this.args.program && this.args.program.length > 0) {
            return [this.args.program, ...programArgs];
        }
        return programArgs;
    }
    launchExternalTerminal(sudo, cwd, pythonPath, args, env) {
        return new Promise((resolve, reject) => {
            if (this.canLaunchTerminal) {
                const command = sudo ? 'sudo' : pythonPath;
                const commandArgs = sudo ? [pythonPath].concat(args) : args;
                const isExternalTerminal = this.args.console === 'externalTerminal';
                const consoleKind = isExternalTerminal ? 'external' : 'integrated';
                const termArgs = {
                    kind: consoleKind,
                    title: 'Python Debug Console',
                    cwd,
                    args: [command].concat(commandArgs),
                    env
                };
                this.debugSession.runInTerminalRequest(termArgs, 5000, (response) => {
                    if (response.success) {
                        resolve();
                    }
                    else {
                        reject(response);
                    }
                });
            }
            else {
                open_1.open({ wait: false, app: [pythonPath].concat(args), cwd, env, sudo: sudo }).then(proc => {
                    this.pyProc = proc;
                    resolve();
                }, error => {
                    if (this.debugServerStatus === DebugServerStatus.Running) {
                        return;
                    }
                    reject(error);
                });
            }
        });
    }
}
exports.LocalDebugClient = LocalDebugClient;
//# sourceMappingURL=LocalDebugClient.js.map