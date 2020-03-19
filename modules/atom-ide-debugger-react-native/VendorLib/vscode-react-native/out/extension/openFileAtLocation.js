"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const reactNativeProjectHelper_1 = require("../common/reactNativeProjectHelper");
const internalErrorCode_1 = require("../common/error/internalErrorCode");
const errorHelper_1 = require("../common/error/errorHelper");
const path = require("path");
const Q = require("q");
/* Usage:
...path\openFileAtLocation.js filename:lineNumber
...path\openFileAtLocation.js filename
...path\openFileAtLocation.js workspace filename:lineNumber
...path\openFileAtLocation.js workspace filename
*/
{
    if (process.argv.length < 3) {
        throw "Wrong number of parameters provided. Please refer to the usage of this script for proper use.";
    }
    let fullpath;
    let workspace;
    if (process.argv.length === 3) {
        fullpath = process.argv[2];
        workspace = "";
    }
    else {
        fullpath = process.argv[3];
        workspace = process.argv[2];
    }
    const dirname = path.normalize(path.dirname(fullpath));
    // In Windows this should make sure c:\ is always lowercase and in
    // Unix '/'.toLowerCase() = '/'
    const normalizedDirname = dirname.toLowerCase();
    const filenameAndNumber = path.basename(fullpath);
    const fileInfo = filenameAndNumber.split(":");
    const filename = path.join(normalizedDirname, fileInfo[0]);
    let lineNumber = 1;
    if (fileInfo.length >= 2) {
        lineNumber = parseInt(fileInfo[1], 10);
    }
    getReactNativeWorkspaceForFile(filename, workspace).then(projectRootPath => {
        // BEGIN MODIFIED BY PELMERS
        // END MODIFIED BY PELMERS
    }).done(() => { }, (reason) => {
        throw errorHelper_1.ErrorHelper.getNestedError(reason, internalErrorCode_1.InternalErrorCode.CommandFailed, "Unable to communicate with VSCode. Please make sure it is open in the appropriate workspace.");
    });
}
function getReactNativeWorkspaceForFile(file, workspace) {
    if (workspace) {
        return Q(workspace);
    }
    return getPathForRNParentWorkspace(path.dirname(file))
        .catch((reason) => {
        return Q.reject(errorHelper_1.ErrorHelper.getNestedError(reason, internalErrorCode_1.InternalErrorCode.WorkspaceNotFound, `Error while looking at workspace for file: ${file}.`));
    });
}
function getPathForRNParentWorkspace(dir) {
    return reactNativeProjectHelper_1.ReactNativeProjectHelper.isReactNativeProject(dir).then(isRNProject => {
        if (isRNProject) {
            return dir;
        }
        if (dir === "" || dir === "." || dir === "/" || dir === path.dirname(dir)) {
            return Q.reject(errorHelper_1.ErrorHelper.getInternalError(internalErrorCode_1.InternalErrorCode.WorkspaceNotFound, "React Native project workspace not found."));
        }
        return getPathForRNParentWorkspace(path.dirname(dir));
    });
}

//# sourceMappingURL=openFileAtLocation.js.map
