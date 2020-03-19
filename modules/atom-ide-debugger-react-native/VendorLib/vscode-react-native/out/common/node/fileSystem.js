"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const nodeFs = require("fs");
const path = require("path");
const Q = require("q");
class FileSystem {
    constructor({ fs = nodeFs } = {}) {
        this.fs = fs;
    }
    ensureDirectory(dir) {
        return Q.nfcall(this.fs.stat, dir).then((stat) => {
            if (stat.isDirectory()) {
                return;
            }
            throw new Error(`Expected ${dir} to be a directory`);
        }, (err) => {
            if (err && err.code === "ENOENT") {
                return this.ensureDirectory(path.dirname(dir)).then(() => Q.nfcall(this.fs.mkdir, dir));
            }
            throw err;
        });
    }
    ensureFileWithContents(file, contents) {
        return Q.nfcall(this.fs.stat, file).then((stat) => {
            if (!stat.isFile()) {
                throw new Error(`Expected ${file} to be a file`);
            }
            return this.readFile(file).then(existingContents => {
                if (contents !== existingContents) {
                    return this.writeFile(file, contents);
                }
                return Q.resolve(void 0);
            });
        }, (err) => {
            if (err && err.code === "ENOENT") {
                return Q.nfcall(this.fs.writeFile, file, contents);
            }
            throw err;
        });
    }
    /**
     *  Helper function to check if a file or directory exists
     */
    existsSync(filename) {
        try {
            this.fs.statSync(filename);
            return true;
        }
        catch (error) {
            return false;
        }
    }
    /**
     *  Helper (asynchronous) function to check if a file or directory exists
     */
    exists(filename) {
        return Q.nfcall(this.fs.stat, filename)
            .then(function () {
            return Q.resolve(true);
        })
            .catch(function (err) {
            return Q.resolve(false);
        });
    }
    /**
     *  Helper async function to read the contents of a directory
     */
    readDir(directory) {
        return Q.nfcall(this.fs.readdir, directory);
    }
    /**
     *  Helper (synchronous) function to create a directory recursively
     */
    makeDirectoryRecursiveSync(dirPath) {
        let parentPath = path.dirname(dirPath);
        if (!this.existsSync(parentPath)) {
            this.makeDirectoryRecursiveSync(parentPath);
        }
        this.fs.mkdirSync(dirPath);
    }
    /**
     *  Helper function to asynchronously copy a file
     */
    copyFile(from, to, encoding) {
        let deferred = Q.defer();
        let destFile = this.fs.createWriteStream(to, { encoding: encoding });
        let srcFile = this.fs.createReadStream(from, { encoding: encoding });
        destFile.on("finish", function () {
            deferred.resolve(void 0);
        });
        destFile.on("error", function (e) {
            deferred.reject(e);
        });
        srcFile.on("error", function (e) {
            deferred.reject(e);
        });
        srcFile.pipe(destFile);
        return deferred.promise;
    }
    deleteFileIfExistsSync(filename) {
        if (this.existsSync(filename)) {
            this.fs.unlinkSync(filename);
        }
    }
    readFile(filename, encoding = "utf8") {
        return Q.nfcall(this.fs.readFile, filename, encoding);
    }
    writeFile(filename, data) {
        return Q.nfcall(this.fs.writeFile, filename, data);
    }
    unlink(filename) {
        return Q.nfcall(this.fs.unlink, filename);
    }
    mkDir(p) {
        return Q.nfcall(this.fs.mkdir, p);
    }
    stat(fsPath) {
        return Q.nfcall(this.fs.stat, fsPath);
    }
    directoryExists(directoryPath) {
        return this.stat(directoryPath).then(stats => {
            return stats.isDirectory();
        }).catch(reason => {
            return reason.code === "ENOENT"
                ? false
                : Q.reject(reason);
        });
    }
    /**
     * Delete 'dirPath' if it's an empty folder. If not fail.
     *
     * @param {dirPath} path to the folder
     * @returns {void} Nothing
     */
    rmdir(dirPath) {
        return Q.nfcall(this.fs.rmdir, dirPath);
    }
    /**
     * Recursively copy 'source' to 'target' asynchronously
     *
     * @param {string} source Location to copy from
     * @param {string} target Location to copy to
     * @returns {Q.Promise} A promise which is fulfilled when the copy completes, and is rejected on error
     */
    copyRecursive(source, target) {
        return Q.nfcall(this.fs.stat, source).then(stats => {
            if (stats.isDirectory()) {
                return this.exists(target)
                    .then(exists => {
                    return exists ? void 0 : Q.nfcall(this.fs.mkdir, target);
                })
                    .then(() => {
                    return Q.nfcall(this.fs.readdir, source);
                })
                    .then(contents => {
                    Q.all(contents.map((childPath) => {
                        return this.copyRecursive(path.join(source, childPath), path.join(target, childPath));
                    }));
                });
            }
            else {
                return this.copyFile(source, target);
            }
        });
    }
    removePathRecursivelyAsync(p) {
        return this.exists(p).then(exists => {
            if (exists) {
                return Q.nfcall(this.fs.stat, p).then((stats) => {
                    if (stats.isDirectory()) {
                        return Q.nfcall(this.fs.readdir, p).then((childPaths) => {
                            let result = Q(void 0);
                            childPaths.forEach(childPath => result = result.then(() => this.removePathRecursivelyAsync(path.join(p, childPath))));
                            return result;
                        }).then(() => Q.nfcall(this.fs.rmdir, p));
                    }
                    else {
                        /* file */
                        return Q.nfcall(this.fs.unlink, p);
                    }
                });
            }
            return Q.resolve(void 0);
        });
    }
    removePathRecursivelySync(p) {
        if (this.fs.existsSync(p)) {
            let stats = this.fs.statSync(p);
            if (stats.isDirectory()) {
                let contents = this.fs.readdirSync(p);
                contents.forEach(childPath => this.removePathRecursivelySync(path.join(p, childPath)));
                this.fs.rmdirSync(p);
            }
            else {
                /* file */
                this.fs.unlinkSync(p);
            }
        }
    }
}
exports.FileSystem = FileSystem;

//# sourceMappingURL=fileSystem.js.map
