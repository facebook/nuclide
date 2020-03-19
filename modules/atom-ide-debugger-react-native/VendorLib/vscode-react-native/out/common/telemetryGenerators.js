"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const Q = require("q");
const telemetry_1 = require("./telemetry");
const telemetryHelper_1 = require("./telemetryHelper");
class TelemetryGeneratorBase {
    constructor(componentName) {
        this.telemetryProperties = {};
        this.currentStep = "initialStep";
        this.errorIndex = -1; // In case we have more than one error (We start at -1 because we increment it before using it)
        this.componentName = componentName;
        this.currentStepStartTime = process.hrtime();
    }
    add(baseName, value, isPii) {
        return this.addWithPiiEvaluator(baseName, value, () => isPii);
    }
    addWithPiiEvaluator(baseName, value, piiEvaluator) {
        // We have 3 cases:
        //     * Object is an array, we add each element as baseNameNNN
        //     * Object is a hash, we add each element as baseName.KEY
        //     * Object is a value, we add the element as baseName
        try {
            if (Array.isArray(value)) {
                this.addArray(baseName, value, piiEvaluator);
            }
            else if (!!value && (typeof value === "object" || typeof value === "function")) {
                this.addHash(baseName, value, piiEvaluator);
            }
            else {
                this.addString(baseName, String(value), piiEvaluator);
            }
        }
        catch (error) {
            // We don"t want to crash the functionality if the telemetry fails.
            // This error message will be a javascript error message, so it"s not pii
            this.addString("telemetryGenerationError." + baseName, String(error), () => false);
        }
        return this;
    }
    addError(error) {
        this.add("error.message" + ++this.errorIndex, error.message, /*isPii*/ true);
        let errorWithErrorCode = error;
        if (errorWithErrorCode.errorCode) {
            this.add("error.code" + this.errorIndex, errorWithErrorCode.errorCode, /*isPii*/ false);
        }
        return this;
    }
    time(name, codeToMeasure) {
        let startTime = process.hrtime();
        return Q(codeToMeasure())
            .finally(() => this.finishTime(name, startTime))
            .fail((reason) => {
            this.addError(reason);
            return Q.reject(reason);
        });
    }
    step(name) {
        // First we finish measuring this step time, and we send a telemetry event for this step
        this.finishTime(this.currentStep, this.currentStepStartTime);
        this.sendCurrentStep();
        // Then we prepare to start gathering information about the next step
        this.currentStep = name;
        this.telemetryProperties = {};
        this.currentStepStartTime = process.hrtime();
        return this;
    }
    send() {
        if (this.currentStep) {
            this.add("lastStepExecuted", this.currentStep, /*isPii*/ false);
        }
        this.step(""); // Send the last step
    }
    sendCurrentStep() {
        this.add("step", this.currentStep, /*isPii*/ false);
        let telemetryEvent = new telemetry_1.Telemetry.TelemetryEvent(this.componentName);
        telemetryHelper_1.TelemetryHelper.addTelemetryEventProperties(telemetryEvent, this.telemetryProperties);
        this.sendTelemetryEvent(telemetryEvent);
    }
    addArray(baseName, array, piiEvaluator) {
        // Object is an array, we add each element as baseNameNNN
        let elementIndex = 1; // We send telemetry properties in a one-based index
        array.forEach((element) => this.addWithPiiEvaluator(baseName + elementIndex++, element, piiEvaluator));
    }
    addHash(baseName, hash, piiEvaluator) {
        // Object is a hash, we add each element as baseName.KEY
        Object.keys(hash).forEach((key) => this.addWithPiiEvaluator(baseName + "." + key, hash[key], piiEvaluator));
    }
    addString(name, value, piiEvaluator) {
        this.telemetryProperties[name] = telemetryHelper_1.TelemetryHelper.telemetryProperty(value, piiEvaluator(value, name));
    }
    combine(...components) {
        let nonNullComponents = components.filter((component) => component !== null);
        return nonNullComponents.join(".");
    }
    finishTime(name, startTime) {
        let endTime = process.hrtime(startTime);
        this.add(this.combine(name, "time"), String(endTime[0] * 1000 + endTime[1] / 1000000), /*isPii*/ false);
    }
}
exports.TelemetryGeneratorBase = TelemetryGeneratorBase;
class TelemetryGenerator extends TelemetryGeneratorBase {
    sendTelemetryEvent(telemetryEvent) {
        telemetry_1.Telemetry.send(telemetryEvent);
    }
}
exports.TelemetryGenerator = TelemetryGenerator;

//# sourceMappingURL=telemetryGenerators.js.map
