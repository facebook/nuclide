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
const errorUtils_1 = require("../../client/common/errors/errorUtils");
const moduleNotInstalledError_1 = require("../../client/common/errors/moduleNotInstalledError");
const decoder_1 = require("../../client/common/process/decoder");
const proc_1 = require("../../client/common/process/proc");
const platform_1 = require("../../client/common/utils/platform");
class MockPythonExecutionService {
    constructor() {
        this.pythonPath = 'python';
        this.procService = new proc_1.ProcessService(new decoder_1.BufferDecoder());
    }
    getInterpreterInformation() {
        return Promise.resolve({
            path: '',
            version: '3.6',
            sysVersion: '1.0',
            sysPrefix: '1.0',
            architecture: platform_1.Architecture.x64,
            version_info: [3, 6, 0, 'beta']
        });
    }
    getExecutablePath() {
        return Promise.resolve(this.pythonPath);
    }
    isModuleInstalled(moduleName) {
        return this.procService.exec(this.pythonPath, ['-c', `import ${moduleName}`], { throwOnStdErr: true })
            .then(() => true).catch(() => false);
    }
    execObservable(args, options) {
        const opts = Object.assign({}, options);
        return this.procService.execObservable(this.pythonPath, args, opts);
    }
    execModuleObservable(moduleName, args, options) {
        const opts = Object.assign({}, options);
        return this.procService.execObservable(this.pythonPath, ['-m', moduleName, ...args], opts);
    }
    exec(args, options) {
        const opts = Object.assign({}, options);
        return this.procService.exec(this.pythonPath, args, opts);
    }
    execModule(moduleName, args, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const opts = Object.assign({}, options);
            const result = yield this.procService.exec(this.pythonPath, ['-m', moduleName, ...args], opts);
            // If a module is not installed we'll have something in stderr.
            if (moduleName && errorUtils_1.ErrorUtils.outputHasModuleNotInstalledError(moduleName, result.stderr)) {
                const isInstalled = yield this.isModuleInstalled(moduleName);
                if (!isInstalled) {
                    throw new moduleNotInstalledError_1.ModuleNotInstalledError(moduleName);
                }
            }
            return result;
        });
    }
}
exports.MockPythonExecutionService = MockPythonExecutionService;
//# sourceMappingURL=executionServiceMock.js.map