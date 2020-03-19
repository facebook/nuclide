"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const Q = require("q");
const path = require("path");
const fs = require("fs");
const stripJsonComments = require("strip-json-comments");
const telemetry_1 = require("../common/telemetry");
const telemetryHelper_1 = require("../common/telemetryHelper");
const remoteExtension_1 = require("../common/remoteExtension");
const telemetryReporters_1 = require("../common/telemetryReporters");
const vscode_chrome_debug_core_1 = require("vscode-chrome-debug-core");
const vscode_debugadapter_1 = require("vscode-debugadapter");
const appWorker_1 = require("./appWorker");
function makeSession(debugSessionClass, debugSessionOpts, telemetryReporter, appName, version) {
    return class extends debugSessionClass {
        constructor(debuggerLinesAndColumnsStartAt1, isServer) {
            super(debuggerLinesAndColumnsStartAt1, isServer, debugSessionOpts);
            this.appWorker = null;
        }
        // Override ChromeDebugSession's sendEvent to control what we will send to client
        sendEvent(event) {
            // Do not send "terminated" events signaling about session's restart to client as it would cause it
            // to restart adapter's process, while we want to stay alive and don't want to interrupt connection
            // to packager.
            if (event.event === "terminated" && event.body && event.body.restart) {
                // Worker has been reloaded and switched to "continue" state
                // So we have to send "continued" event to client instead of "terminated"
                // Otherwise client might mistakenly show "stopped" state
                let continuedEvent = {
                    event: "continued",
                    type: "event",
                    seq: event["seq"],
                    body: { threadId: event.body.threadId },
                };
                super.sendEvent(continuedEvent);
                return;
            }
            super.sendEvent(event);
        }
        dispatchRequest(request) {
            if (request.command === "disconnect")
                return this.disconnect(request);
            if (request.command === "attach")
                return this.attach(request);
            if (request.command === "launch")
                return this.launch(request);
            return super.dispatchRequest(request);
        }
        launch(request) {
            this.requestSetup(request.arguments);
            this.remoteExtension.launch(request)
                .then(() => {
                return this.remoteExtension.getPackagerPort(request.arguments.program);
            })
                .then((packagerPort) => {
                this.attachRequest(Object.assign({}, request, { arguments: Object.assign({}, request.arguments, { port: packagerPort }) }));
            })
                .catch(error => {
                this.bailOut(error.data || error.message);
            });
        }
        attach(request) {
            this.requestSetup(request.arguments);
            this.remoteExtension.getPackagerPort(request.arguments.program)
                .then((packagerPort) => {
                this.attachRequest(Object.assign({}, request, { arguments: Object.assign({}, request.arguments, { port: request.arguments.port || packagerPort }) }));
            });
        }
        disconnect(request) {
            // The client is about to disconnect so first we need to stop app worker
            if (this.appWorker) {
                this.appWorker.stop();
            }
            // Then we tell the extension to stop monitoring the logcat, and then we disconnect the debugging session
            if (request.arguments.platform === "android") {
                this.remoteExtension.stopMonitoringLogcat()
                    .catch(reason => vscode_chrome_debug_core_1.logger.warn(`Couldn't stop monitoring logcat: ${reason.message || reason}`))
                    .finally(() => super.dispatchRequest(request));
            }
            else {
                super.dispatchRequest(request);
            }
        }
        requestSetup(args) {
            let logLevel = args.trace;
            if (logLevel) {
                logLevel = logLevel.replace(logLevel[0], logLevel[0].toUpperCase());
                vscode_chrome_debug_core_1.logger.setup(vscode_debugadapter_1.Logger.LogLevel[logLevel], false);
            }
            else {
                vscode_chrome_debug_core_1.logger.setup(vscode_debugadapter_1.Logger.LogLevel.Log, false);
            }
            this.projectRootPath = getProjectRoot(args);
            // BEGIN MODIFIED BY PELMERS
            this.remoteExtension = remoteExtension_1.RemoteExtension.atProjectRootPath(this.projectRootPath, args.port);
            // END MODIFIED BY PELMERS
            // Start to send telemetry
            telemetryReporter.reassignTo(new telemetryReporters_1.ExtensionTelemetryReporter(appName, version, telemetry_1.Telemetry.APPINSIGHTS_INSTRUMENTATIONKEY, this.projectRootPath));
        }
        /**
         * Runs logic needed to attach.
         * Attach should:
         * - Enable js debugging
         */
        // tslint:disable-next-line:member-ordering
        attachRequest(request) {
            return telemetryHelper_1.TelemetryHelper.generate("attach", (generator) => {
                return Q({})
                    .then(() => {
                    vscode_chrome_debug_core_1.logger.log("Starting debugger app worker.");
                    // TODO: remove dependency on args.program - "program" property is technically
                    // no more required in launch configuration and could be removed
                    const workspaceRootPath = path.resolve(path.dirname(request.arguments.program), "..");
                    const sourcesStoragePath = path.join(workspaceRootPath, ".vscode", ".react");
                    // If launch is invoked first time, appWorker is undefined, so create it here
                    this.appWorker = new appWorker_1.MultipleLifetimesAppWorker(request.arguments, sourcesStoragePath, this.projectRootPath, undefined);
                    this.appWorker.on("connected", (port) => {
                        vscode_chrome_debug_core_1.logger.log("Debugger worker loaded runtime on port " + port);
                        // Don't mutate original request to avoid side effects
                        let attachArguments = Object.assign({}, request.arguments, {
                            address: "localhost",
                            port,
                            restart: true,
                            request: "attach",
                            remoteRoot: undefined,
                            localRoot: undefined,
                        });
                        let attachRequest = Object.assign({}, request, { command: "attach", arguments: attachArguments });
                        // Reinstantiate debug adapter, as the current implementation of ChromeDebugAdapter
                        // doesn't allow us to reattach to another debug target easily. As of now it's easier
                        // to throw previous instance out and create a new one.
                        this._debugAdapter = new debugSessionOpts.adapter(debugSessionOpts, this);
                        super.dispatchRequest(attachRequest);
                    });
                    return this.appWorker.start();
                })
                    .catch(error => this.bailOut(error.message));
            });
        }
        /**
         * Logs error to user and finishes the debugging process.
         */
        bailOut(message) {
            vscode_chrome_debug_core_1.logger.error(`Could not debug. ${message}`);
            this.sendEvent(new vscode_debugadapter_1.TerminatedEvent());
        }
    };
}
exports.makeSession = makeSession;
function makeAdapter(debugAdapterClass) {
    return class extends debugAdapterClass {
        doAttach(port, targetUrl, address, timeout) {
            // We need to overwrite ChromeDebug's _attachMode to let Node2 adapter
            // to set up breakpoints on initial pause event
            this._attachMode = false;
            return super.doAttach(port, targetUrl, address, timeout);
        }
    };
}
exports.makeAdapter = makeAdapter;
/**
 * Parses settings.json file for workspace root property
 */
function getProjectRoot(args) {
    try {
        let vsCodeRoot = path.resolve(args.program, "../..");
        let settingsPath = path.resolve(vsCodeRoot, ".vscode/settings.json");
        let settingsContent = fs.readFileSync(settingsPath, "utf8");
        settingsContent = stripJsonComments(settingsContent);
        let parsedSettings = JSON.parse(settingsContent);
        let projectRootPath = parsedSettings["react-native-tools.projectRoot"] || parsedSettings["react-native-tools"].projectRoot;
        return path.resolve(vsCodeRoot, projectRootPath);
    }
    catch (e) {
        return path.resolve(args.program, "../..");
    }
}

//# sourceMappingURL=nodeDebugWrapper.js.map
