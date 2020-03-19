"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("inversify");
const path = require("path");
const vscode_1 = require("vscode");
const types_1 = require("../../common/process/types");
const stopWatch_1 = require("../../common/utils/stopWatch");
const types_2 = require("../../ioc/types");
const telemetry_1 = require("../../telemetry");
const constants_1 = require("../../telemetry/constants");
const contracts_1 = require("../contracts");
const types_3 = require("./types");
let PythonPathUpdaterService = class PythonPathUpdaterService {
    constructor(serviceContainer) {
        this.pythonPathSettingsUpdaterFactory = serviceContainer.get(types_3.IPythonPathUpdaterServiceFactory);
        this.interpreterVersionService = serviceContainer.get(contracts_1.IInterpreterVersionService);
        this.executionFactory = serviceContainer.get(types_1.IPythonExecutionFactory);
    }
    updatePythonPath(pythonPath, configTarget, trigger, wkspace) {
        return __awaiter(this, void 0, void 0, function* () {
            const stopWatch = new stopWatch_1.StopWatch();
            const pythonPathUpdater = this.getPythonUpdaterService(configTarget, wkspace);
            let failed = false;
            try {
                yield pythonPathUpdater.updatePythonPath(path.normalize(pythonPath));
            }
            catch (reason) {
                failed = true;
                // tslint:disable-next-line:no-unsafe-any prefer-type-cast
                const message = reason && typeof reason.message === 'string' ? reason.message : '';
                vscode_1.window.showErrorMessage(`Failed to set 'pythonPath'. Error: ${message}`);
                console.error(reason);
            }
            // do not wait for this to complete
            this.sendTelemetry(stopWatch.elapsedTime, failed, trigger, pythonPath)
                .catch(ex => console.error('Python Extension: sendTelemetry', ex));
        });
    }
    sendTelemetry(duration, failed, trigger, pythonPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const telemtryProperties = {
                failed, trigger
            };
            if (!failed) {
                const processService = yield this.executionFactory.create({ pythonPath });
                const infoPromise = processService.getInterpreterInformation()
                    .catch(() => undefined);
                const pipVersionPromise = this.interpreterVersionService.getPipVersion(pythonPath)
                    .then(value => value.length === 0 ? undefined : value)
                    .catch(() => '');
                const [info, pipVersion] = yield Promise.all([infoPromise, pipVersionPromise]);
                if (info) {
                    telemtryProperties.pythonVersion = info.version_info.join('.');
                }
                if (pipVersion) {
                    telemtryProperties.pipVersion = pipVersion;
                }
            }
            telemetry_1.sendTelemetryEvent(constants_1.PYTHON_INTERPRETER, duration, telemtryProperties);
        });
    }
    getPythonUpdaterService(configTarget, wkspace) {
        switch (configTarget) {
            case vscode_1.ConfigurationTarget.Global: {
                return this.pythonPathSettingsUpdaterFactory.getGlobalPythonPathConfigurationService();
            }
            case vscode_1.ConfigurationTarget.Workspace: {
                if (!wkspace) {
                    throw new Error('Workspace Uri not defined');
                }
                // tslint:disable-next-line:no-non-null-assertion
                return this.pythonPathSettingsUpdaterFactory.getWorkspacePythonPathConfigurationService(wkspace);
            }
            default: {
                if (!wkspace) {
                    throw new Error('Workspace Uri not defined');
                }
                // tslint:disable-next-line:no-non-null-assertion
                return this.pythonPathSettingsUpdaterFactory.getWorkspaceFolderPythonPathConfigurationService(wkspace);
            }
        }
    }
};
PythonPathUpdaterService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_2.IServiceContainer))
], PythonPathUpdaterService);
exports.PythonPathUpdaterService = PythonPathUpdaterService;
//# sourceMappingURL=pythonPathUpdaterService.js.map