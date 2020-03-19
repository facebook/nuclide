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
const fs = require("fs-extra");
const glob = require("glob");
const path = require("path");
const semver_1 = require("semver");
const vscode_1 = require("vscode");
const configSettings_1 = require("../client/common/configSettings");
const constants_1 = require("../client/common/constants");
const logger_1 = require("../client/common/logger");
const decoder_1 = require("../client/common/process/decoder");
const proc_1 = require("../client/common/process/proc");
const misc_1 = require("../client/common/utils/misc");
const platform_1 = require("../client/common/utils/platform");
const initialize_1 = require("./initialize");
var core_1 = require("./core");
exports.sleep = core_1.sleep;
// tslint:disable:no-invalid-this no-any
const fileInNonRootWorkspace = path.join(constants_1.EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'dummy.py');
exports.rootWorkspaceUri = getWorkspaceRoot();
exports.PYTHON_PATH = getPythonPath();
function updateSetting(setting, value, resource, configTarget) {
    return __awaiter(this, void 0, void 0, function* () {
        const settings = vscode_1.workspace.getConfiguration('python', resource);
        const currentValue = settings.inspect(setting);
        if (currentValue !== undefined && ((configTarget === vscode_1.ConfigurationTarget.Global && currentValue.globalValue === value) ||
            (configTarget === vscode_1.ConfigurationTarget.Workspace && currentValue.workspaceValue === value) ||
            (configTarget === vscode_1.ConfigurationTarget.WorkspaceFolder && currentValue.workspaceFolderValue === value))) {
            configSettings_1.PythonSettings.dispose();
            return;
        }
        yield settings.update(setting, value, configTarget);
        // We've experienced trouble with .update in the past, where VSC returns stale data even
        // after invoking the update method. This issue has regressed a few times as well. This
        // delay is merely a backup to ensure it extension doesn't break the tests due to similar
        // regressions in VSC:
        // await sleep(2000);
        // ... please see issue #2356 and PR #2332 for a discussion on the matter
        configSettings_1.PythonSettings.dispose();
    });
}
exports.updateSetting = updateSetting;
// In some tests we will be mocking VS Code API (mocked classes)
const globalPythonPathSetting = vscode_1.workspace.getConfiguration('python') ? vscode_1.workspace.getConfiguration('python').inspect('pythonPath').globalValue : 'python';
exports.clearPythonPathInWorkspaceFolder = (resource) => __awaiter(this, void 0, void 0, function* () { return retryAsync(setPythonPathInWorkspace)(resource, vscode_1.ConfigurationTarget.WorkspaceFolder); });
exports.setPythonPathInWorkspaceRoot = (pythonPath) => __awaiter(this, void 0, void 0, function* () { return retryAsync(setPythonPathInWorkspace)(undefined, vscode_1.ConfigurationTarget.Workspace, pythonPath); });
exports.resetGlobalPythonPathSetting = () => __awaiter(this, void 0, void 0, function* () { return retryAsync(restoreGlobalPythonPathSetting)(); });
function getWorkspaceRoot() {
    if (!Array.isArray(vscode_1.workspace.workspaceFolders) || vscode_1.workspace.workspaceFolders.length === 0) {
        return vscode_1.Uri.file(path.join(constants_1.EXTENSION_ROOT_DIR, 'src', 'test'));
    }
    if (vscode_1.workspace.workspaceFolders.length === 1) {
        return vscode_1.workspace.workspaceFolders[0].uri;
    }
    const workspaceFolder = vscode_1.workspace.getWorkspaceFolder(vscode_1.Uri.file(fileInNonRootWorkspace));
    return workspaceFolder ? workspaceFolder.uri : vscode_1.workspace.workspaceFolders[0].uri;
}
function retryAsync(wrapped, retryCount = 2) {
    return (...args) => __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            const reasons = [];
            const makeCall = () => {
                wrapped.call(this, ...args)
                    .then(resolve, (reason) => {
                    reasons.push(reason);
                    if (reasons.length >= retryCount) {
                        reject(reasons);
                    }
                    else {
                        // If failed once, lets wait for some time before trying again.
                        setTimeout(makeCall, 500);
                    }
                });
            };
            makeCall();
        });
    });
}
exports.retryAsync = retryAsync;
function setPythonPathInWorkspace(resource, config, pythonPath) {
    return __awaiter(this, void 0, void 0, function* () {
        if (config === vscode_1.ConfigurationTarget.WorkspaceFolder && !initialize_1.IS_MULTI_ROOT_TEST) {
            return;
        }
        const resourceUri = typeof resource === 'string' ? vscode_1.Uri.file(resource) : resource;
        const settings = vscode_1.workspace.getConfiguration('python', resourceUri);
        const value = settings.inspect('pythonPath');
        const prop = config === vscode_1.ConfigurationTarget.Workspace ? 'workspaceValue' : 'workspaceFolderValue';
        if (value && value[prop] !== pythonPath) {
            yield settings.update('pythonPath', pythonPath, config);
            configSettings_1.PythonSettings.dispose();
        }
    });
}
function restoreGlobalPythonPathSetting() {
    return __awaiter(this, void 0, void 0, function* () {
        const pythonConfig = vscode_1.workspace.getConfiguration('python', null);
        const currentGlobalPythonPathSetting = pythonConfig.inspect('pythonPath').globalValue;
        if (globalPythonPathSetting !== currentGlobalPythonPathSetting) {
            yield pythonConfig.update('pythonPath', undefined, true);
        }
        configSettings_1.PythonSettings.dispose();
    });
}
function deleteDirectory(dir) {
    return __awaiter(this, void 0, void 0, function* () {
        const exists = yield fs.pathExists(dir);
        if (exists) {
            yield fs.remove(dir);
        }
    });
}
exports.deleteDirectory = deleteDirectory;
function deleteFile(file) {
    return __awaiter(this, void 0, void 0, function* () {
        const exists = yield fs.pathExists(file);
        if (exists) {
            yield fs.remove(file);
        }
    });
}
exports.deleteFile = deleteFile;
function deleteFiles(globPattern) {
    return __awaiter(this, void 0, void 0, function* () {
        const items = yield new Promise((resolve, reject) => {
            glob(globPattern, (ex, files) => ex ? reject(ex) : resolve(files));
        });
        return Promise.all(items.map(item => fs.remove(item).catch(misc_1.noop)));
    });
}
exports.deleteFiles = deleteFiles;
function getPythonPath() {
    if (process.env.CI_PYTHON_PATH && fs.existsSync(process.env.CI_PYTHON_PATH)) {
        return process.env.CI_PYTHON_PATH;
    }
    return 'python';
}
/**
 * Determine if the current platform is included in a list of platforms.
 *
 * @param {OSes} OSType[] List of operating system Ids to check within.
 * @return true if the current OS matches one from the list, false otherwise.
 */
function isOs(...OSes) {
    // get current OS
    const currentOS = platform_1.getOSType();
    // compare and return
    if (OSes.indexOf(currentOS) === -1) {
        return false;
    }
    return true;
}
exports.isOs = isOs;
/**
 * Get the current Python interpreter version.
 *
 * @param {procService} IProcessService Optionally specify the IProcessService implementation to use to execute with.
 * @return `SemVer` version of the Python interpreter, or `undefined` if an error occurs.
 */
function getPythonSemVer(procService) {
    return __awaiter(this, void 0, void 0, function* () {
        const pythonProcRunner = procService ? procService : new proc_1.ProcessService(new decoder_1.BufferDecoder());
        const pyVerArgs = ['-c', 'import sys;print("{0}.{1}.{2}".format(*sys.version_info[:3]))'];
        return pythonProcRunner.exec(exports.PYTHON_PATH, pyVerArgs)
            .then(strVersion => new semver_1.SemVer(strVersion.stdout.trim()))
            .catch((err) => {
            // if the call fails this should make it loudly apparent.
            logger_1.traceError('getPythonSemVer', err);
            return undefined;
        });
    });
}
exports.getPythonSemVer = getPythonSemVer;
/**
 * Match a given semver version specification with a list of loosely defined
 * version strings.
 *
 * Specify versions by their major version at minimum - the minor and patch
 * version numbers are optional.
 *
 * '3', '3.6', '3.6.6', are all vald and only the portions specified will be matched
 * against the current running Python interpreter version.
 *
 * Example scenarios:
 * '3' will match version 3.5.6, 3.6.4, 3.6.6, and 3.7.0.
 * '3.6' will match version 3.6.4 and 3.6.6.
 * '3.6.4' will match version 3.6.4 only.
 *
 * @param {version} SemVer the version to look for.
 * @param {searchVersions} string[] List of loosely-specified versions to match against.
 */
function isVersionInList(version, ...searchVersions) {
    // see if the major/minor version matches any member of the skip-list.
    const isPresent = searchVersions.findIndex(ver => {
        const semverChecker = semver_1.coerce(ver);
        if (semverChecker) {
            if (semverChecker.compare(version) === 0) {
                return true;
            }
            else {
                // compare all the parts of the version that we have, we know we have
                // at minimum the major version or semverChecker would be 'null'...
                const versionParts = ver.split('.');
                let matches = parseInt(versionParts[0], 10) === version.major;
                if (matches && versionParts.length >= 2) {
                    matches = parseInt(versionParts[1], 10) === version.minor;
                }
                if (matches && versionParts.length >= 3) {
                    matches = parseInt(versionParts[2], 10) === version.patch;
                }
                return matches;
            }
        }
        return false;
    });
    if (isPresent >= 0) {
        return true;
    }
    return false;
}
exports.isVersionInList = isVersionInList;
/**
 * Determine if the Python interpreter version running in a given `IProcessService`
 * is in a selection of versions.
 *
 * You can specify versions by specifying the major version at minimum - the minor and
 * patch version numbers are optional.
 *
 * '3', '3.6', '3.6.6', are all vald and only the portions specified will be matched
 * against the current running Python interpreter version.
 *
 * Example scenarios:
 * '3' will match version 3.5.6, 3.6.4, 3.6.6, and 3.7.0.
 * '3.6' will match version 3.6.4 and 3.6.6.
 * '3.6.4' will match version 3.6.4 only.
 *
 * If you don't need to specify the environment (ie. the workspace) that the Python
 * interpreter is running under, use the simpler `isPythonVersion` instead.
 *
 * @param {procService} IProcessService Optionally, use this process service to call out to python with.
 * @param {versions} string[] Python versions to test for, specified as described above.
 * @return true if the current Python version matches a version in the skip list, false otherwise.
 */
function isPythonVersionInProcess(procService, ...versions) {
    return __awaiter(this, void 0, void 0, function* () {
        // get the current python version major/minor
        const currentPyVersion = yield getPythonSemVer(procService);
        if (currentPyVersion) {
            return isVersionInList(currentPyVersion, ...versions);
        }
        else {
            logger_1.traceError(`Failed to determine the current Python version when comparing against list [${versions.join(', ')}].`);
            return false;
        }
    });
}
exports.isPythonVersionInProcess = isPythonVersionInProcess;
/**
 * Determine if the current interpreter version is in a given selection of versions.
 *
 * You can specify versions by using up to the first three semver parts of a python
 * version.
 *
 * '3', '3.6', '3.6.6', are all vald and only the portions specified will be matched
 * against the current running Python interpreter version.
 *
 * Example scenarios:
 * '3' will match version 3.5.6, 3.6.4, 3.6.6, and 3.7.0.
 * '3.6' will match version 3.6.4 and 3.6.6.
 * '3.6.4' will match version 3.6.4 only.
 *
 * If you need to specify the environment (ie. the workspace) that the Python
 * interpreter is running under, use `isPythonVersionInProcess` instead.
 *
 * @param {versions} string[] List of versions of python that are to be skipped.
 * @param {resource} vscode.Uri Current workspace resource Uri or undefined.
 * @return true if the current Python version matches a version in the skip list, false otherwise.
 */
function isPythonVersion(...versions) {
    return __awaiter(this, void 0, void 0, function* () {
        const currentPyVersion = yield getPythonSemVer();
        if (currentPyVersion) {
            return isVersionInList(currentPyVersion, ...versions);
        }
        else {
            logger_1.traceError(`Failed to determine the current Python version when comparing against list [${versions.join(', ')}].`);
            return false;
        }
    });
}
exports.isPythonVersion = isPythonVersion;
//# sourceMappingURL=common.js.map