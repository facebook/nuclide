"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable-next-line:no-reference
/// <reference path="./vscode-extension-telemetry.d.ts" />
const vscode_1 = require("vscode");
const constants_1 = require("../common/constants");
const stopWatch_1 = require("../common/utils/stopWatch");
let telemetryReporter;
function getTelemetryReporter() {
    if (telemetryReporter) {
        return telemetryReporter;
    }
    const extensionId = constants_1.PVSC_EXTENSION_ID;
    // tslint:disable-next-line:no-non-null-assertion
    const extension = vscode_1.extensions.getExtension(extensionId);
    // tslint:disable-next-line:no-unsafe-any
    const extensionVersion = extension.packageJSON.version;
    // tslint:disable-next-line:no-unsafe-any
    const aiKey = extension.packageJSON.contributes.debuggers[0].aiKey;
    // tslint:disable-next-line:no-require-imports
    const reporter = require('vscode-extension-telemetry').default;
    return telemetryReporter = new reporter(extensionId, extensionVersion, aiKey);
}
function sendTelemetryEvent(eventName, durationMs, properties) {
    if (constants_1.isTestExecution()) {
        return;
    }
    const reporter = getTelemetryReporter();
    const measures = typeof durationMs === 'number' ? { duration: durationMs } : (durationMs ? durationMs : undefined);
    // tslint:disable-next-line:no-any
    const customProperties = {};
    if (properties) {
        // tslint:disable-next-line:prefer-type-cast no-any
        const data = properties;
        Object.getOwnPropertyNames(data).forEach(prop => {
            if (data[prop] === undefined || data[prop] === null) {
                return;
            }
            // tslint:disable-next-line:prefer-type-cast no-any  no-unsafe-any
            customProperties[prop] = typeof data[prop] === 'string' ? data[prop] : data[prop].toString();
        });
    }
    reporter.sendTelemetryEvent(eventName, properties ? customProperties : undefined, measures);
}
exports.sendTelemetryEvent = sendTelemetryEvent;
// tslint:disable-next-line:no-any function-name
function captureTelemetry(eventName, properties, captureDuration = true) {
    // tslint:disable-next-line:no-function-expression no-any
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        // tslint:disable-next-line:no-function-expression no-any
        descriptor.value = function (...args) {
            if (!captureDuration) {
                sendTelemetryEvent(eventName, undefined, properties);
                // tslint:disable-next-line:no-invalid-this
                return originalMethod.apply(this, args);
            }
            const stopWatch = new stopWatch_1.StopWatch();
            // tslint:disable-next-line:no-invalid-this no-use-before-declare no-unsafe-any
            const result = originalMethod.apply(this, args);
            // If method being wrapped returns a promise then wait for it.
            // tslint:disable-next-line:no-unsafe-any
            if (result && typeof result.then === 'function' && typeof result.catch === 'function') {
                // tslint:disable-next-line:prefer-type-cast
                result
                    .then(data => {
                    sendTelemetryEvent(eventName, stopWatch.elapsedTime, properties);
                    return data;
                })
                    // tslint:disable-next-line:promise-function-async
                    .catch(ex => {
                    // tslint:disable-next-line:no-any
                    sendTelemetryEvent(eventName, stopWatch.elapsedTime, properties);
                    return Promise.reject(ex);
                });
            }
            else {
                sendTelemetryEvent(eventName, stopWatch.elapsedTime, properties);
            }
            return result;
        };
        return descriptor;
    };
}
exports.captureTelemetry = captureTelemetry;
// tslint:disable-next-line:no-any function-name
function sendTelemetryWhenDone(eventName, promise, stopWatch, properties) {
    stopWatch = stopWatch ? stopWatch : new stopWatch_1.StopWatch();
    if (typeof promise.then === 'function') {
        // tslint:disable-next-line:prefer-type-cast no-any
        promise
            .then(data => {
            // tslint:disable-next-line:no-non-null-assertion
            sendTelemetryEvent(eventName, stopWatch.elapsedTime, properties);
            return data;
            // tslint:disable-next-line:promise-function-async
        }, ex => {
            // tslint:disable-next-line:no-non-null-assertion
            sendTelemetryEvent(eventName, stopWatch.elapsedTime, properties);
            return Promise.reject(ex);
        });
    }
    else {
        throw new Error('Method is neither a Promise nor a Theneable');
    }
}
exports.sendTelemetryWhenDone = sendTelemetryWhenDone;
//# sourceMappingURL=index.js.map