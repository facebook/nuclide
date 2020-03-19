// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const tmp = require("tmp");
function fsExistsAsync(filePath) {
    return new Promise(resolve => {
        fs.exists(filePath, exists => {
            return resolve(exists);
        });
    });
}
exports.fsExistsAsync = fsExistsAsync;
function fsReaddirAsync(root) {
    return new Promise(resolve => {
        // Now look for Interpreters in this directory
        fs.readdir(root, (err, subDirs) => {
            if (err) {
                return resolve([]);
            }
            resolve(subDirs.map(subDir => path.join(root, subDir)));
        });
    });
}
exports.fsReaddirAsync = fsReaddirAsync;
function getSubDirectories(rootDir) {
    return new Promise(resolve => {
        fs.readdir(rootDir, (error, files) => {
            if (error) {
                return resolve([]);
            }
            const subDirs = [];
            files.forEach(name => {
                const fullPath = path.join(rootDir, name);
                try {
                    if (fs.statSync(fullPath).isDirectory()) {
                        subDirs.push(fullPath);
                    }
                }
                // tslint:disable-next-line:no-empty one-line
                catch (ex) { }
            });
            resolve(subDirs);
        });
    });
}
exports.getSubDirectories = getSubDirectories;
function createTemporaryFile(extension, temporaryDirectory) {
    // tslint:disable-next-line:no-any
    const options = { postfix: extension };
    if (temporaryDirectory) {
        options.dir = temporaryDirectory;
    }
    return new Promise((resolve, reject) => {
        tmp.file(options, (err, tmpFile, fd, cleanupCallback) => {
            if (err) {
                return reject(err);
            }
            resolve({ filePath: tmpFile, cleanupCallback: cleanupCallback });
        });
    });
}
exports.createTemporaryFile = createTemporaryFile;
//# sourceMappingURL=fs.js.map