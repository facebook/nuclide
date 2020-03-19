"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
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
const constants_1 = require("../constants");
const errorUtils_1 = require("../errors/errorUtils");
const moduleNotInstalledError_1 = require("../errors/moduleNotInstalledError");
const types_1 = require("../platform/types");
const platform_1 = require("../utils/platform");
let PythonExecutionService = class PythonExecutionService {
    constructor(serviceContainer, procService, pythonPath) {
        this.procService = procService;
        this.pythonPath = pythonPath;
        this.fileSystem = serviceContainer.get(types_1.IFileSystem);
    }
    getInterpreterInformation() {
        return __awaiter(this, void 0, void 0, function* () {
            const file = path.join(constants_1.EXTENSION_ROOT_DIR, 'pythonFiles', 'interpreterInfo.py');
            try {
                const [version, jsonValue] = yield Promise.all([
                    this.procService.exec(this.pythonPath, ['--version'], { mergeStdOutErr: true })
                        .then(output => output.stdout.trim()),
                    this.procService.exec(this.pythonPath, [file], { mergeStdOutErr: true })
                        .then(output => output.stdout.trim())
                ]);
                const json = JSON.parse(jsonValue);
                const version_info = json.versionInfo;
                // Exclude PII from `version_info` to ensure we don't send this up via telemetry.
                for (let index = 0; index < 3; index += 1) {
                    if (typeof version_info[index] !== 'number') {
                        version_info[index] = 0;
                    }
                }
                if (['alpha', 'beta', 'candidate', 'final'].indexOf(version_info[3]) === -1) {
                    version_info[3] = 'unknown';
                }
                return {
                    architecture: json.is64Bit ? platform_1.Architecture.x64 : platform_1.Architecture.x86,
                    path: this.pythonPath,
                    version,
                    sysVersion: json.sysVersion,
                    version_info: json.versionInfo,
                    sysPrefix: json.sysPrefix
                };
            }
            catch (ex) {
                console.error(`Failed to get interpreter information for '${this.pythonPath}'`, ex);
            }
        });
    }
    getExecutablePath() {
        return __awaiter(this, void 0, void 0, function* () {
            // If we've passed the python file, then return the file.
            // This is because on mac if using the interpreter /usr/bin/python2.7 we can get a different value for the path
            if (yield this.fileSystem.fileExists(this.pythonPath)) {
                return this.pythonPath;
            }
            return this.procService.exec(this.pythonPath, ['-c', 'import sys;print(sys.executable)'], { throwOnStdErr: true })
                .then(output => output.stdout.trim());
        });
    }
    isModuleInstalled(moduleName) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.procService.exec(this.pythonPath, ['-c', `import ${moduleName}`], { throwOnStdErr: true })
                .then(() => true).catch(() => false);
        });
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
        return __awaiter(this, void 0, void 0, function* () {
            const opts = Object.assign({}, options);
            return this.procService.exec(this.pythonPath, args, opts);
        });
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
};
PythonExecutionService = __decorate([
    inversify_1.injectable()
], PythonExecutionService);
exports.PythonExecutionService = PythonExecutionService;
//# sourceMappingURL=pythonProcess.js.map