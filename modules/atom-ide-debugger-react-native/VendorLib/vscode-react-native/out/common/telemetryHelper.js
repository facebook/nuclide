"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const telemetry_1 = require("./telemetry");
const telemetryGenerators_1 = require("./telemetryGenerators");
class TelemetryHelper {
    static sendSimpleEvent(eventName, properties) {
        const event = TelemetryHelper.createTelemetryEvent(eventName, properties);
        telemetry_1.Telemetry.send(event);
    }
    static createTelemetryEvent(eventName, properties) {
        return new telemetry_1.Telemetry.TelemetryEvent(eventName, properties);
    }
    static telemetryProperty(propertyValue, pii) {
        return { value: String(propertyValue), isPii: pii || false };
    }
    static addTelemetryEventProperties(event, properties) {
        if (!properties) {
            return;
        }
        Object.keys(properties).forEach(function (propertyName) {
            TelemetryHelper.addTelemetryEventProperty(event, propertyName, properties[propertyName].value, properties[propertyName].isPii);
        });
    }
    static sendCommandSuccessTelemetry(commandName, commandProperties, args = []) {
        let successEvent = TelemetryHelper.createBasicCommandTelemetry(commandName, args);
        TelemetryHelper.addTelemetryEventProperties(successEvent, commandProperties);
        telemetry_1.Telemetry.send(successEvent);
    }
    static addTelemetryEventProperty(event, propertyName, propertyValue, isPii) {
        if (Array.isArray(propertyValue)) {
            TelemetryHelper.addMultiValuedTelemetryEventProperty(event, propertyName, propertyValue, isPii);
        }
        else {
            TelemetryHelper.setTelemetryEventProperty(event, propertyName, propertyValue, isPii);
        }
    }
    static addPropertiesFromOptions(telemetryProperties, knownOptions, commandOptions, nonPiiOptions = []) {
        // We parse only the known options, to avoid potential private information that may appear on the command line
        let unknownOptionIndex = 1;
        Object.keys(commandOptions).forEach((key) => {
            let value = commandOptions[key];
            if (Object.keys(knownOptions).indexOf(key) >= 0) {
                // This is a known option. We"ll check the list to decide if it"s pii or not
                if (typeof (value) !== "undefined") {
                    // We encrypt all options values unless they are specifically marked as nonPii
                    telemetryProperties["options." + key] = this.telemetryProperty(value, nonPiiOptions.indexOf(key) < 0);
                }
            }
            else {
                // This is a not known option. We"ll assume that both the option and the value are pii
                telemetryProperties["unknownOption" + unknownOptionIndex + ".name"] = this.telemetryProperty(key, /*isPii*/ true);
                telemetryProperties["unknownOption" + unknownOptionIndex++ + ".value"] = this.telemetryProperty(value, /*isPii*/ true);
            }
        });
        return telemetryProperties;
    }
    static generate(name, codeGeneratingTelemetry) {
        let generator = new telemetryGenerators_1.TelemetryGenerator(name);
        return generator.time("", () => codeGeneratingTelemetry(generator)).finally(() => generator.send());
    }
    static createBasicCommandTelemetry(commandName, args = []) {
        let commandEvent = new telemetry_1.Telemetry.TelemetryEvent(commandName || "command");
        if (!commandName && args && args.length > 0) {
            commandEvent.setPiiProperty("command", args[0]);
        }
        if (args) {
            TelemetryHelper.addTelemetryEventProperty(commandEvent, "argument", args, true);
        }
        return commandEvent;
    }
    static setTelemetryEventProperty(event, propertyName, propertyValue, isPii) {
        if (isPii) {
            event.setPiiProperty(propertyName, String(propertyValue));
        }
        else {
            event.properties[propertyName] = String(propertyValue);
        }
    }
    static addMultiValuedTelemetryEventProperty(event, propertyName, propertyValue, isPii) {
        for (let i = 0; i < propertyValue.length; i++) {
            TelemetryHelper.setTelemetryEventProperty(event, propertyName + i, propertyValue[i], isPii);
        }
    }
}
exports.TelemetryHelper = TelemetryHelper;

//# sourceMappingURL=telemetryHelper.js.map
