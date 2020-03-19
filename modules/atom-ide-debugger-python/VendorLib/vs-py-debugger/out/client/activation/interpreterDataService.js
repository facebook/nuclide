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
const crypto_1 = require("crypto");
const fs = require("fs");
const path = require("path");
const types_1 = require("../common/application/types");
require("../common/extensions");
const types_2 = require("../common/platform/types");
const types_3 = require("../common/process/types");
const async_1 = require("../common/utils/async");
const DataVersion = 1;
class InterpreterData {
    constructor(dataVersion, 
    // tslint:disable-next-line:no-shadowed-variable
    path, version, searchPaths, hash) {
        this.dataVersion = dataVersion;
        this.path = path;
        this.version = version;
        this.searchPaths = searchPaths;
        this.hash = hash;
    }
}
exports.InterpreterData = InterpreterData;
class InterpreterDataService {
    constructor(context, serviceContainer) {
        this.context = context;
        this.serviceContainer = serviceContainer;
    }
    getInterpreterData(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const executionFactory = this.serviceContainer.get(types_3.IPythonExecutionFactory);
            const execService = yield executionFactory.create({ resource });
            const interpreterPath = yield execService.getExecutablePath();
            if (interpreterPath.length === 0) {
                return;
            }
            const cacheKey = `InterpreterData-${interpreterPath}`;
            let interpreterData = this.context.globalState.get(cacheKey);
            let interpreterChanged = false;
            if (interpreterData) {
                // Check if interpreter executable changed
                if (interpreterData.dataVersion !== DataVersion) {
                    interpreterChanged = true;
                }
                else {
                    const currentHash = yield this.getInterpreterHash(interpreterPath);
                    interpreterChanged = currentHash !== interpreterData.hash;
                }
            }
            if (interpreterChanged || !interpreterData) {
                interpreterData = yield this.getInterpreterDataFromPython(execService, interpreterPath);
                this.context.globalState.update(interpreterPath, interpreterData);
            }
            else {
                // Make sure we verify that search paths did not change. This must be done
                // completely async so we don't delay Python language server startup.
                this.verifySearchPaths(interpreterData.searchPaths, interpreterPath, execService);
            }
            return interpreterData;
        });
    }
    getInterpreterHash(interpreterPath) {
        const platform = this.serviceContainer.get(types_2.IPlatformService);
        const pythonExecutable = path.join(path.dirname(interpreterPath), platform.isWindows ? 'python.exe' : 'python');
        // Hash mod time and creation time
        const deferred = async_1.createDeferred();
        fs.lstat(pythonExecutable, (err, stats) => {
            if (err) {
                deferred.resolve('');
            }
            else {
                const actual = crypto_1.createHash('sha512').update(`${stats.ctime}-${stats.mtime}`).digest('hex');
                deferred.resolve(actual);
            }
        });
        return deferred.promise;
    }
    getInterpreterDataFromPython(execService, interpreterPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield execService.exec(['-c', 'import sys; print(sys.version_info)'], {});
            // sys.version_info(major=3, minor=6, micro=6, releaselevel='final', serial=0)
            if (!result.stdout) {
                throw Error('Unable to determine Python interpreter version and system prefix.');
            }
            const output = result.stdout.splitLines({ removeEmptyEntries: true, trim: true });
            if (!output || output.length < 1) {
                throw Error('Unable to parse version and and system prefix from the Python interpreter output.');
            }
            const majorMatches = output[0].match(/major=(\d*?),/);
            const minorMatches = output[0].match(/minor=(\d*?),/);
            if (!majorMatches || majorMatches.length < 2 || !minorMatches || minorMatches.length < 2) {
                throw Error('Unable to parse interpreter version.');
            }
            const hash = yield this.getInterpreterHash(interpreterPath);
            const searchPaths = yield this.getSearchPaths(execService);
            return new InterpreterData(DataVersion, interpreterPath, `${majorMatches[1]}.${minorMatches[1]}`, searchPaths, hash);
        });
    }
    getSearchPaths(execService) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield execService.exec(['-c', 'import sys; import os; print(sys.path + os.getenv("PYTHONPATH", "").split(os.pathsep));'], {});
            if (!result.stdout) {
                throw Error('Unable to determine Python interpreter search paths.');
            }
            // tslint:disable-next-line:no-unnecessary-local-variable
            const paths = result.stdout.split(',')
                .filter(p => this.isValidPath(p))
                .map(p => this.pathCleanup(p));
            return paths.join(';'); // PTVS uses ; on all platforms
        });
    }
    pathCleanup(s) {
        s = s.trim();
        if (s[0] === '\'') {
            s = s.substr(1);
        }
        if (s[s.length - 1] === ']') {
            s = s.substr(0, s.length - 1);
        }
        if (s[s.length - 1] === '\'') {
            s = s.substr(0, s.length - 1);
        }
        return s;
    }
    isValidPath(s) {
        return s.length > 0 && s[0] !== '[';
    }
    verifySearchPaths(currentPaths, interpreterPath, execService) {
        this.getSearchPaths(execService)
            .then((paths) => __awaiter(this, void 0, void 0, function* () {
            if (paths !== currentPaths) {
                this.context.globalState.update(interpreterPath, undefined);
                const appShell = this.serviceContainer.get(types_1.IApplicationShell);
                yield appShell.showWarningMessage('Search paths have changed for this Python interpreter. Please reload the extension to ensure that the IntelliSense works correctly.');
            }
        })).ignoreErrors();
    }
}
exports.InterpreterDataService = InterpreterDataService;
//# sourceMappingURL=interpreterDataService.js.map