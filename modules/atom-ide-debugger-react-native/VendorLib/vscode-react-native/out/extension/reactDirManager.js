"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const OutputChannelLogger_1 = require("./log/OutputChannelLogger");
const errorHelper_1 = require("../common/error/errorHelper");
const internalErrorCode_1 = require("../common/error/internalErrorCode");
const fileSystem_1 = require("../common/node/fileSystem");
const entryPointHandler_1 = require("../common/entryPointHandler");
/**
 * Manages the lifecycle of the .vscode/.react folder, which hosts the temporary source/map files we need for debugging.
 * We use synchronous operations here because we want to return after the init/cleanup has been done.
 */
class ReactDirManager {
    constructor(rootPath) {
        this.isDisposed = false;
        this.vscodeDirPath = path.join(rootPath || "", ".vscode");
        this.reactDirPath = path.join(this.vscodeDirPath, ".react");
    }
    setup() {
        this.isDisposed = false;
        let fs = new fileSystem_1.FileSystem();
        /* if the folder exists, remove it, then recreate it */
        return fs.removePathRecursivelyAsync(this.reactDirPath)
            .then(() => {
            if (!fs.existsSync(this.vscodeDirPath)) {
                return fs.mkDir(this.vscodeDirPath);
            }
            return void 0;
        }).then(() => fs.mkDir(this.reactDirPath));
    }
    dispose() {
        this.isDisposed = true;
        new entryPointHandler_1.EntryPointHandler(entryPointHandler_1.ProcessType.Extension, OutputChannelLogger_1.OutputChannelLogger.getMainChannel())
            .runFunction("extension.deleteTemporaryFolder", errorHelper_1.ErrorHelper.getInternalError(internalErrorCode_1.InternalErrorCode.RNTempFolderDeletionFailed, this.reactDirPath), () => new fileSystem_1.FileSystem().removePathRecursivelySync(this.reactDirPath));
    }
}
exports.ReactDirManager = ReactDirManager;

//# sourceMappingURL=reactDirManager.js.map
