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
const vscode_1 = require("vscode");
const async_1 = require("../common/utils/async");
const stopWatch_1 = require("../common/utils/stopWatch");
const telemetry_1 = require("../telemetry");
const constants_1 = require("../telemetry/constants");
// Draw the line at Language Server analysis 'timing out'
// and becoming a failure-case at 1 minute:
const ANALYSIS_TIMEOUT_MS = 60000;
class ProgressReporting {
    constructor(languageClient) {
        this.languageClient = languageClient;
        this.languageClient.onNotification('python/setStatusBarMessage', (m) => {
            if (this.statusBarMessage) {
                this.statusBarMessage.dispose();
            }
            this.statusBarMessage = vscode_1.window.setStatusBarMessage(m);
        });
        this.languageClient.onNotification('python/beginProgress', (_) => __awaiter(this, void 0, void 0, function* () {
            if (this.progressDeferred) {
                return;
            }
            this.progressDeferred = async_1.createDeferred();
            this.progressTimer = new stopWatch_1.StopWatch();
            this.progressTimeout = setTimeout(this.handleTimeout.bind(this), ANALYSIS_TIMEOUT_MS);
            vscode_1.window.withProgress({
                location: vscode_1.ProgressLocation.Window,
                title: ''
            }, progress => {
                this.progress = progress;
                return this.progressDeferred.promise;
            });
        }));
        this.languageClient.onNotification('python/reportProgress', (m) => {
            if (!this.progress) {
                return;
            }
            this.progress.report({ message: m });
        });
        this.languageClient.onNotification('python/endProgress', _ => {
            if (this.progressDeferred) {
                this.progressDeferred.resolve();
                this.progressDeferred = undefined;
                this.progress = undefined;
                this.completeAnalysisTracking(true);
            }
        });
    }
    dispose() {
        if (this.statusBarMessage) {
            this.statusBarMessage.dispose();
        }
    }
    completeAnalysisTracking(success) {
        if (this.progressTimer) {
            telemetry_1.sendTelemetryEvent(constants_1.PYTHON_LANGUAGE_SERVER_ANALYSISTIME, this.progressTimer.elapsedTime, { success });
        }
        this.progressTimer = undefined;
        this.progressTimeout = undefined;
    }
    // tslint:disable-next-line:no-any
    handleTimeout(_args) {
        this.completeAnalysisTracking(false);
    }
}
exports.ProgressReporting = ProgressReporting;
//# sourceMappingURL=progress.js.map