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
const path = require("path");
const requestProgress = require("request-progress");
const vscode_1 = require("vscode");
const constants_1 = require("../common/constants");
const types_1 = require("../common/platform/types");
const types_2 = require("../common/types");
const async_1 = require("../common/utils/async");
const stopWatch_1 = require("../common/utils/stopWatch");
const telemetry_1 = require("../telemetry");
const constants_2 = require("../telemetry/constants");
const types_3 = require("./types");
// tslint:disable-next-line:no-require-imports no-var-requires
const StreamZip = require('node-stream-zip');
const downloadFileExtension = '.nupkg';
class LanguageServerDownloader {
    constructor(platformData, engineFolder, serviceContainer) {
        this.platformData = platformData;
        this.engineFolder = engineFolder;
        this.serviceContainer = serviceContainer;
        this.output = this.serviceContainer.get(types_2.IOutputChannel, constants_1.STANDARD_OUTPUT_CHANNEL);
        this.fs = this.serviceContainer.get(types_1.IFileSystem);
    }
    getDownloadInfo() {
        return __awaiter(this, void 0, void 0, function* () {
            const lsFolderService = this.serviceContainer.get(types_3.ILanguageServerFolderService);
            return lsFolderService.getLatestLanguageServerVersion().then(item => item);
        });
    }
    downloadLanguageServer(context) {
        return __awaiter(this, void 0, void 0, function* () {
            const downloadInfo = yield this.getDownloadInfo();
            const downloadUri = downloadInfo.uri;
            const lsVersion = downloadInfo.version.raw;
            const timer = new stopWatch_1.StopWatch();
            let success = true;
            let localTempFilePath = '';
            try {
                localTempFilePath = yield this.downloadFile(downloadUri, 'Downloading Microsoft Python Language Server... ');
            }
            catch (err) {
                this.output.appendLine('download failed.');
                this.output.appendLine(err);
                success = false;
                throw new Error(err);
            }
            finally {
                telemetry_1.sendTelemetryEvent(constants_2.PYTHON_LANGUAGE_SERVER_DOWNLOADED, timer.elapsedTime, { success, lsVersion });
            }
            timer.reset();
            try {
                yield this.unpackArchive(context.extensionPath, localTempFilePath);
            }
            catch (err) {
                this.output.appendLine('extraction failed.');
                this.output.appendLine(err);
                success = false;
                throw new Error(err);
            }
            finally {
                telemetry_1.sendTelemetryEvent(constants_2.PYTHON_LANGUAGE_SERVER_EXTRACTED, timer.elapsedTime, { success, lsVersion });
                yield this.fs.deleteFile(localTempFilePath);
            }
        });
    }
    downloadFile(uri, title) {
        return __awaiter(this, void 0, void 0, function* () {
            this.output.append(`Downloading ${uri}... `);
            const tempFile = yield this.fs.createTemporaryFile(downloadFileExtension);
            const deferred = async_1.createDeferred();
            const fileStream = this.fs.createWriteStream(tempFile.filePath);
            fileStream.on('finish', () => {
                fileStream.close();
            }).on('error', (err) => {
                tempFile.dispose();
                deferred.reject(err);
            });
            yield vscode_1.window.withProgress({
                location: vscode_1.ProgressLocation.Window
            }, (progress) => {
                const httpClient = this.serviceContainer.get(types_3.IHttpClient);
                requestProgress(httpClient.downloadFile(uri))
                    .on('progress', (state) => {
                    // https://www.npmjs.com/package/request-progress
                    const received = Math.round(state.size.transferred / 1024);
                    const total = Math.round(state.size.total / 1024);
                    const percentage = Math.round(100 * state.percent);
                    progress.report({
                        message: `${title}${received} of ${total} KB (${percentage}%)`
                    });
                })
                    .on('error', (err) => {
                    deferred.reject(err);
                })
                    .on('end', () => {
                    this.output.appendLine('complete.');
                    deferred.resolve();
                })
                    .pipe(fileStream);
                return deferred.promise;
            });
            return tempFile.filePath;
        });
    }
    unpackArchive(extensionPath, tempFilePath) {
        return __awaiter(this, void 0, void 0, function* () {
            this.output.append('Unpacking archive... ');
            const installFolder = path.join(extensionPath, this.engineFolder);
            const deferred = async_1.createDeferred();
            const title = 'Extracting files... ';
            yield vscode_1.window.withProgress({
                location: vscode_1.ProgressLocation.Window
            }, (progress) => {
                const zip = new StreamZip({
                    file: tempFilePath,
                    storeEntries: true
                });
                let totalFiles = 0;
                let extractedFiles = 0;
                zip.on('ready', () => __awaiter(this, void 0, void 0, function* () {
                    totalFiles = zip.entriesCount;
                    if (!(yield this.fs.directoryExists(installFolder))) {
                        yield this.fs.createDirectory(installFolder);
                    }
                    zip.extract(null, installFolder, (err) => {
                        if (err) {
                            deferred.reject(err);
                        }
                        else {
                            deferred.resolve();
                        }
                        zip.close();
                    });
                })).on('extract', () => {
                    extractedFiles += 1;
                    progress.report({ message: `${title}${Math.round(100 * extractedFiles / totalFiles)}%` });
                }).on('error', e => {
                    deferred.reject(e);
                });
                return deferred.promise;
            });
            // Set file to executable (nothing happens in Windows, as chmod has no definition there)
            const executablePath = path.join(installFolder, this.platformData.getEngineExecutableName());
            yield this.fs.chmod(executablePath, '0764'); // -rwxrw-r--
            this.output.appendLine('done.');
        });
    }
}
exports.LanguageServerDownloader = LanguageServerDownloader;
//# sourceMappingURL=downloader.js.map