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
/*
Comparing performance metrics is not easy (the metrics can and always get skewed).
One approach is to run the tests multile times and gather multiple sample data.
For Extension activation times, we load both extensions x times, and re-load the window y times in each x load.
I.e. capture averages by giving the extensions sufficient time to warm up.
This block of code merely launches the tests by using either the dev or release version of the extension,
and spawning the tests (mimic user starting tests from command line), this way we can run tests multiple times.
*/
// tslint:disable:no-console no-require-imports no-var-requires
const child_process_1 = require("child_process");
const download = require("download");
const fs = require("fs-extra");
const path = require("path");
const request = require("request");
const constants_1 = require("../client/common/constants");
const NamedRegexp = require('named-js-regexp');
const StreamZip = require('node-stream-zip');
const del = require('del');
const tmpFolder = path.join(constants_1.EXTENSION_ROOT_DIR, 'tmp');
const publishedExtensionPath = path.join(tmpFolder, 'ext', 'testReleaseExtensionsFolder');
const logFilesPath = path.join(tmpFolder, 'test', 'logs');
var Version;
(function (Version) {
    Version[Version["Dev"] = 0] = "Dev";
    Version[Version["Release"] = 1] = "Release";
})(Version || (Version = {}));
class TestRunner {
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            yield del([path.join(tmpFolder, '**')]);
            yield this.extractLatestExtension(publishedExtensionPath);
            const timesToLoadEachVersion = 2;
            const devLogFiles = [];
            const releaseLogFiles = [];
            const languageServerLogFiles = [];
            for (let i = 0; i < timesToLoadEachVersion; i += 1) {
                yield this.enableLanguageServer(false);
                const devLogFile = path.join(logFilesPath, `dev_loadtimes${i}.txt`);
                console.log(`Start Performance Tests: Counter ${i}, for Dev version with Jedi`);
                yield this.capturePerfTimes(Version.Dev, devLogFile);
                devLogFiles.push(devLogFile);
                const releaseLogFile = path.join(logFilesPath, `release_loadtimes${i}.txt`);
                console.log(`Start Performance Tests: Counter ${i}, for Release version with Jedi`);
                yield this.capturePerfTimes(Version.Release, releaseLogFile);
                releaseLogFiles.push(releaseLogFile);
                // Language server.
                yield this.enableLanguageServer(true);
                const languageServerLogFile = path.join(logFilesPath, `languageServer_loadtimes${i}.txt`);
                console.log(`Start Performance Tests: Counter ${i}, for Release version with Language Server`);
                yield this.capturePerfTimes(Version.Release, languageServerLogFile);
                languageServerLogFiles.push(languageServerLogFile);
            }
            console.log('Compare Performance Results');
            yield this.runPerfTest(devLogFiles, releaseLogFiles, languageServerLogFiles);
        });
    }
    enableLanguageServer(enable) {
        return __awaiter(this, void 0, void 0, function* () {
            const settings = `{ "python.jediEnabled": ${!enable} }`;
            yield fs.writeFile(path.join(constants_1.EXTENSION_ROOT_DIR, 'src', 'test', 'performance', 'settings.json'), settings);
        });
    }
    capturePerfTimes(version, logFile) {
        return __awaiter(this, void 0, void 0, function* () {
            const releaseVersion = yield this.getReleaseVersion();
            const devVersion = yield this.getDevVersion();
            yield fs.ensureDir(path.dirname(logFile));
            const env = {
                ACTIVATION_TIMES_LOG_FILE_PATH: logFile,
                ACTIVATION_TIMES_EXT_VERSION: version === Version.Release ? releaseVersion : devVersion,
                CODE_EXTENSIONS_PATH: version === Version.Release ? publishedExtensionPath : constants_1.EXTENSION_ROOT_DIR
            };
            yield this.launchTest(env);
        });
    }
    runPerfTest(devLogFiles, releaseLogFiles, languageServerLogFiles) {
        return __awaiter(this, void 0, void 0, function* () {
            const env = {
                ACTIVATION_TIMES_DEV_LOG_FILE_PATHS: JSON.stringify(devLogFiles),
                ACTIVATION_TIMES_RELEASE_LOG_FILE_PATHS: JSON.stringify(releaseLogFiles),
                ACTIVATION_TIMES_DEV_LANGUAGE_SERVER_LOG_FILE_PATHS: JSON.stringify(languageServerLogFiles)
            };
            yield this.launchTest(env);
        });
    }
    launchTest(customEnvVars) {
        return __awaiter(this, void 0, void 0, function* () {
            yield new Promise((resolve, reject) => {
                const env = Object.assign({ TEST_FILES_SUFFIX: 'perf.test', CODE_TESTS_WORKSPACE: path.join(constants_1.EXTENSION_ROOT_DIR, 'src', 'test', 'performance') }, process.env, customEnvVars);
                const proc = child_process_1.spawn('node', [path.join(__dirname, 'standardTest.js')], { cwd: constants_1.EXTENSION_ROOT_DIR, env });
                proc.stdout.pipe(process.stdout);
                proc.stderr.pipe(process.stderr);
                proc.on('error', reject);
                proc.on('close', code => {
                    if (code === 0) {
                        resolve();
                    }
                    else {
                        reject(`Failed with code ${code}.`);
                    }
                });
            });
        });
    }
    extractLatestExtension(targetDir) {
        return __awaiter(this, void 0, void 0, function* () {
            const extensionFile = yield this.downloadExtension();
            yield this.unzip(extensionFile, targetDir);
        });
    }
    getReleaseVersion() {
        return __awaiter(this, void 0, void 0, function* () {
            const url = `https://marketplace.visualstudio.com/items?itemName=${constants_1.PVSC_EXTENSION_ID}`;
            const content = yield new Promise((resolve, reject) => {
                request(url, (error, response, body) => {
                    if (error) {
                        return reject(error);
                    }
                    if (response.statusCode === 200) {
                        return resolve(body);
                    }
                    reject(`Status code of ${response.statusCode} received.`);
                });
            });
            const re = NamedRegexp('"version"\S?:\S?"(:<version>\\d{4}\\.\\d{1,2}\\.\\d{1,2})"', 'g');
            const matches = re.exec(content);
            return matches.groups().version;
        });
    }
    getDevVersion() {
        return __awaiter(this, void 0, void 0, function* () {
            // tslint:disable-next-line:non-literal-require
            return require(path.join(constants_1.EXTENSION_ROOT_DIR, 'package.json')).version;
        });
    }
    unzip(zipFile, targetFolder) {
        return __awaiter(this, void 0, void 0, function* () {
            yield fs.ensureDir(targetFolder);
            return new Promise((resolve, reject) => {
                const zip = new StreamZip({
                    file: zipFile,
                    storeEntries: true
                });
                zip.on('ready', () => __awaiter(this, void 0, void 0, function* () {
                    zip.extract('extension', targetFolder, err => {
                        if (err) {
                            reject(err);
                        }
                        else {
                            resolve();
                        }
                        zip.close();
                    });
                }));
            });
        });
    }
    downloadExtension() {
        return __awaiter(this, void 0, void 0, function* () {
            const version = yield this.getReleaseVersion();
            const url = `https://marketplace.visualstudio.com/_apis/public/gallery/publishers/ms-python/vsextensions/python/${version}/vspackage`;
            const destination = path.join(__dirname, `extension${version}.zip`);
            if (yield fs.pathExists(destination)) {
                return destination;
            }
            yield download(url, path.dirname(destination), { filename: path.basename(destination) });
            return destination;
        });
    }
}
new TestRunner().start().catch(ex => console.error('Error in running Performance Tests', ex));
//# sourceMappingURL=performanceTest.js.map