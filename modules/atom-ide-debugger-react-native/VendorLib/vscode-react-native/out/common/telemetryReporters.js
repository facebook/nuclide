"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
class ExtensionTelemetryReporter {
    constructor(extensionId, extensionVersion, key, projectRootPath) {
        this.extensionId = extensionId;
        this.extensionVersion = extensionVersion;
        this.appInsightsKey = key;
        // BEGIN MODIFIED BY PELMERS
        // END MODIFIED BY PELMERS
    }
    sendTelemetryEvent(eventName, properties, measures) {
        // BEGIN MODIFIED BY PELMERS
        // END MODIFIED BY PELMERS
    }
}
exports.ExtensionTelemetryReporter = ExtensionTelemetryReporter;
class NullTelemetryReporter {
    sendTelemetryEvent(eventName, properties, measures) {
        // Don't do anything
    }
}
exports.NullTelemetryReporter = NullTelemetryReporter;
class ReassignableTelemetryReporter {
    constructor(initialReporter) {
        this.reporter = initialReporter;
    }
    reassignTo(reporter) {
        this.reporter = reporter;
    }
    sendTelemetryEvent(eventName, properties, measures) {
        this.reporter.sendTelemetryEvent(eventName, properties, measures);
    }
}
exports.ReassignableTelemetryReporter = ReassignableTelemetryReporter;

//# sourceMappingURL=telemetryReporters.js.map
