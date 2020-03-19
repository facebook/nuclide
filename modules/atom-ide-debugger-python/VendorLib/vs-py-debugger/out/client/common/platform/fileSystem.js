// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
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
const crypto_1 = require("crypto");
const fileSystem = require("fs");
const fs = require("fs-extra");
const glob = require("glob");
const inversify_1 = require("inversify");
const path = require("path");
const tmp = require("tmp");
const async_1 = require("../utils/async");
const types_1 = require("./types");
let FileSystem = class FileSystem {
    constructor(platformService) {
        this.platformService = platformService;
    }
    get directorySeparatorChar() {
        return path.sep;
    }
    objectExists(filePath, statCheck) {
        return new Promise(resolve => {
            fs.stat(filePath, (error, stats) => {
                if (error) {
                    return resolve(false);
                }
                return resolve(statCheck(stats));
            });
        });
    }
    fileExists(filePath) {
        return this.objectExists(filePath, (stats) => stats.isFile());
    }
    fileExistsSync(filePath) {
        return fs.existsSync(filePath);
    }
    /**
     * Reads the contents of the file using utf8 and returns the string contents.
     * @param {string} filePath
     * @returns {Promise<string>}
     * @memberof FileSystem
     */
    readFile(filePath) {
        return fs.readFile(filePath).then(buffer => buffer.toString());
    }
    writeFile(filePath, data) {
        return __awaiter(this, void 0, void 0, function* () {
            yield fs.writeFile(filePath, data, { encoding: 'utf8' });
        });
    }
    directoryExists(filePath) {
        return this.objectExists(filePath, (stats) => stats.isDirectory());
    }
    createDirectory(directoryPath) {
        return fs.mkdirp(directoryPath);
    }
    getSubDirectories(rootDir) {
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
                        // tslint:disable-next-line:no-empty
                    }
                    catch (ex) { }
                });
                resolve(subDirs);
            });
        });
    }
    arePathsSame(path1, path2) {
        path1 = path.normalize(path1);
        path2 = path.normalize(path2);
        if (this.platformService.isWindows) {
            return path1.toUpperCase() === path2.toUpperCase();
        }
        else {
            return path1 === path2;
        }
    }
    appendFileSync(filename, data, optionsOrEncoding) {
        return fs.appendFileSync(filename, data, optionsOrEncoding);
    }
    getRealPath(filePath) {
        return new Promise(resolve => {
            fs.realpath(filePath, (err, realPath) => {
                resolve(err ? filePath : realPath);
            });
        });
    }
    copyFile(src, dest) {
        const deferred = async_1.createDeferred();
        const rs = fs.createReadStream(src).on('error', (err) => {
            deferred.reject(err);
        });
        const ws = fs.createWriteStream(dest).on('error', (err) => {
            deferred.reject(err);
        }).on('close', () => {
            deferred.resolve();
        });
        rs.pipe(ws);
        return deferred.promise;
    }
    deleteFile(filename) {
        const deferred = async_1.createDeferred();
        fs.unlink(filename, err => err ? deferred.reject(err) : deferred.resolve());
        return deferred.promise;
    }
    getFileHash(filePath) {
        return new Promise(resolve => {
            fs.lstat(filePath, (err, stats) => {
                if (err) {
                    resolve();
                }
                else {
                    const actual = crypto_1.createHash('sha512').update(`${stats.ctimeMs}-${stats.mtimeMs}`).digest('hex');
                    resolve(actual);
                }
            });
        });
    }
    search(globPattern) {
        return new Promise((resolve, reject) => {
            glob(globPattern, (ex, files) => {
                if (ex) {
                    return reject(ex);
                }
                resolve(Array.isArray(files) ? files : []);
            });
        });
    }
    createTemporaryFile(extension) {
        return new Promise((resolve, reject) => {
            tmp.file({ postfix: extension }, (err, tmpFile, _, cleanupCallback) => {
                if (err) {
                    return reject(err);
                }
                resolve({ filePath: tmpFile, dispose: cleanupCallback });
            });
        });
    }
    createWriteStream(filePath) {
        return fileSystem.createWriteStream(filePath);
    }
    chmod(filePath, mode) {
        return new Promise((resolve, reject) => {
            fileSystem.chmod(filePath, mode, (err) => {
                if (err) {
                    return reject(err);
                }
                resolve();
            });
        });
    }
};
FileSystem = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IPlatformService))
], FileSystem);
exports.FileSystem = FileSystem;
//# sourceMappingURL=fileSystem.js.map