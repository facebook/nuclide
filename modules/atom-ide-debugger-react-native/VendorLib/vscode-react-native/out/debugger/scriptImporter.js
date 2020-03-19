"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const fileSystem_1 = require("../common/node/fileSystem");
const vscode_chrome_debug_core_1 = require("vscode-chrome-debug-core");
const packagerStatus_1 = require("../common/packagerStatus");
const path = require("path");
const Q = require("q");
const request_1 = require("../common/node/request");
const sourceMap_1 = require("./sourceMap");
const url = require("url");
const semver = require("semver");
const reactNativeProjectHelper_1 = require("../common/reactNativeProjectHelper");
class ScriptImporter {
    constructor(packagerAddress, packagerPort, sourcesStoragePath, packagerRemoteRoot, packagerLocalRoot) {
        this.packagerAddress = packagerAddress;
        this.packagerPort = packagerPort;
        this.sourcesStoragePath = sourcesStoragePath;
        this.packagerRemoteRoot = packagerRemoteRoot;
        this.packagerLocalRoot = packagerLocalRoot;
        this.sourceMapUtil = new sourceMap_1.SourceMapUtil();
    }
    downloadAppScript(scriptUrlString) {
        const parsedScriptUrl = url.parse(scriptUrlString);
        const overriddenScriptUrlString = (parsedScriptUrl.hostname === "localhost") ? this.overridePackagerPort(scriptUrlString) : scriptUrlString;
        // We'll get the source code, and store it locally to have a better debugging experience
        return request_1.Request.request(overriddenScriptUrlString, true).then(scriptBody => {
            // Extract sourceMappingURL from body
            let scriptUrl = url.parse(overriddenScriptUrlString); // scriptUrl = "http://localhost:8081/index.ios.bundle?platform=ios&dev=true"
            let sourceMappingUrl = this.sourceMapUtil.getSourceMapURL(scriptUrl, scriptBody); // sourceMappingUrl = "http://localhost:8081/index.ios.map?platform=ios&dev=true"
            let waitForSourceMapping = Q(void 0);
            if (sourceMappingUrl) {
                /* handle source map - request it and store it locally */
                waitForSourceMapping = this.writeAppSourceMap(sourceMappingUrl, scriptUrl)
                    .then(() => {
                    scriptBody = this.sourceMapUtil.updateScriptPaths(scriptBody, sourceMappingUrl);
                });
            }
            return waitForSourceMapping
                .then(() => this.writeAppScript(scriptBody, scriptUrl))
                .then((scriptFilePath) => {
                vscode_chrome_debug_core_1.logger.verbose(`Script ${overriddenScriptUrlString} downloaded to ${scriptFilePath}`);
                return { contents: scriptBody, filepath: scriptFilePath };
            });
        });
    }
    downloadDebuggerWorker(sourcesStoragePath, projectRootPath) {
        const errPackagerNotRunning = new RangeError(`Cannot attach to packager. Are you sure there is a packager and it is running in the port ${this.packagerPort}? If your packager is configured to run in another port make sure to add that to the setting.json.`);
        // BEGIN MODIFIED BY PELMERS
        const fs = new fileSystem_1.FileSystem();
        return packagerStatus_1.ensurePackagerRunning(this.packagerAddress, this.packagerPort, errPackagerNotRunning)
            .then(() => fs.ensureDirectory(sourcesStoragePath))
            .then(() => {
            return reactNativeProjectHelper_1.ReactNativeProjectHelper.getReactNativeVersion(projectRootPath);
        })
            .then((rnVersion) => {
            let newPackager = "";
            const isHaulProject = reactNativeProjectHelper_1.ReactNativeProjectHelper.isHaulProject(projectRootPath);
            if (semver.gte(rnVersion, "0.50.0") && !isHaulProject) {
                newPackager = "debugger-ui/";
            }
            let debuggerWorkerURL = `http://${this.packagerAddress}:${this.packagerPort}/${newPackager}${ScriptImporter.DEBUGGER_WORKER_FILENAME}`;
            let debuggerWorkerLocalPath = path.join(sourcesStoragePath, ScriptImporter.DEBUGGER_WORKER_FILENAME);
            vscode_chrome_debug_core_1.logger.verbose("About to download: " + debuggerWorkerURL + " to: " + debuggerWorkerLocalPath);
            return request_1.Request.request(debuggerWorkerURL, true)
                .then((body) => {
                return fs.writeFile(debuggerWorkerLocalPath, body);
                // END MODIFIED BY PELMERS
            });
        });
    }
    /**
     * Writes the script file to the project temporary location.
     */
    writeAppScript(scriptBody, scriptUrl) {
        let scriptFilePath = path.join(this.sourcesStoragePath, path.basename(scriptUrl.pathname)); // scriptFilePath = "$TMPDIR/index.ios.bundle"
        return new fileSystem_1.FileSystem().writeFile(scriptFilePath, scriptBody)
            .then(() => scriptFilePath);
    }
    /**
     * Writes the source map file to the project temporary location.
     */
    writeAppSourceMap(sourceMapUrl, scriptUrl) {
        return request_1.Request.request(sourceMapUrl.href, true)
            .then((sourceMapBody) => {
            let sourceMappingLocalPath = path.join(this.sourcesStoragePath, path.basename(sourceMapUrl.pathname)); // sourceMappingLocalPath = "$TMPDIR/index.ios.map"
            let scriptFileRelativePath = path.basename(scriptUrl.pathname); // scriptFileRelativePath = "index.ios.bundle"
            let updatedContent = this.sourceMapUtil.updateSourceMapFile(sourceMapBody, scriptFileRelativePath, this.sourcesStoragePath, this.packagerRemoteRoot, this.packagerLocalRoot);
            return new fileSystem_1.FileSystem().writeFile(sourceMappingLocalPath, updatedContent);
        });
    }
    /**
     * Changes the port of the url to be the one configured as this.packagerPort
     */
    overridePackagerPort(urlToOverride) {
        let components = url.parse(urlToOverride);
        components.port = this.packagerPort.toString();
        delete components.host; // We delete the host, if not the port change will be ignored
        return url.format(components);
    }
}
ScriptImporter.DEBUGGER_WORKER_FILE_BASENAME = "debuggerWorker";
ScriptImporter.DEBUGGER_WORKER_FILENAME = ScriptImporter.DEBUGGER_WORKER_FILE_BASENAME + ".js";
exports.ScriptImporter = ScriptImporter;

//# sourceMappingURL=scriptImporter.js.map
