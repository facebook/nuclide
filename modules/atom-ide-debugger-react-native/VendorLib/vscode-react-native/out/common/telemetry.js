"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
/// <reference path="../typings/winreg/winreg.d.ts" />
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const hostPlatform_1 = require("./hostPlatform");
/**
 * Telemetry module specialized for vscode integration.
 */
var Telemetry;
(function (Telemetry) {
    Telemetry.isOptedIn = false;
    Telemetry.reporterDictionary = {};
    class TelemetryUtils {
        static get telemetrySettingsFile() {
            let settingsHome = hostPlatform_1.HostPlatform.getSettingsHome();
            return path.join(settingsHome, TelemetryUtils.TELEMETRY_SETTINGS_FILENAME);
        }
        static init(appVersion, reporterToUse) {
            TelemetryUtils.loadSettings();
            Telemetry.reporter = reporterToUse;
            TelemetryUtils.userType = TelemetryUtils.getUserType();
            Telemetry.isOptedIn = TelemetryUtils.getTelemetryOptInSetting();
            TelemetryUtils.saveSettings();
        }
        static addCommonProperties(event) {
            if (Telemetry.isOptedIn) {
                event.properties["RN.userId"] = TelemetryUtils.userId;
            }
            event.properties["RN.userType"] = TelemetryUtils.userType;
        }
        static generateGuid() {
            let hexValues = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C", "D", "E", "F"];
            // c.f. rfc4122 (UUID version 4 = xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)
            let oct = "";
            let tmp;
            /* tslint:disable:no-bitwise */
            for (let a = 0; a < 4; a++) {
                tmp = (4294967296 * Math.random()) | 0;
                oct += hexValues[tmp & 0xF] + hexValues[tmp >> 4 & 0xF] + hexValues[tmp >> 8 & 0xF] + hexValues[tmp >> 12 & 0xF] + hexValues[tmp >> 16 & 0xF] + hexValues[tmp >> 20 & 0xF] + hexValues[tmp >> 24 & 0xF] + hexValues[tmp >> 28 & 0xF];
            }
            // "Set the two most significant bits (bits 6 and 7) of the clock_seq_hi_and_reserved to zero and one, respectively"
            let clockSequenceHi = hexValues[8 + (Math.random() * 4) | 0];
            return oct.substr(0, 8) + "-" + oct.substr(9, 4) + "-4" + oct.substr(13, 3) + "-" + clockSequenceHi + oct.substr(16, 3) + "-" + oct.substr(19, 12);
            /* tslint:enable:no-bitwise */
        }
        static getTelemetryOptInSetting() {
            if (TelemetryUtils.telemetrySettings.optIn === undefined) {
                // Opt-in by default
                TelemetryUtils.telemetrySettings.optIn = true;
            }
            return TelemetryUtils.telemetrySettings.optIn;
        }
        static getUserType() {
            let userType = TelemetryUtils.telemetrySettings.userType;
            if (userType === undefined) {
                if (process.env[TelemetryUtils.INTERNAL_USER_ENV_VAR]) {
                    userType = TelemetryUtils.USERTYPE_INTERNAL;
                }
                else {
                    let domain = process.env.USERDNSDOMAIN;
                    domain = domain ? domain.toLowerCase().substring(domain.length - TelemetryUtils.INTERNAL_DOMAIN_SUFFIX.length) : "";
                    userType = domain === TelemetryUtils.INTERNAL_DOMAIN_SUFFIX ? TelemetryUtils.USERTYPE_INTERNAL : TelemetryUtils.USERTYPE_EXTERNAL;
                }
                TelemetryUtils.telemetrySettings.userType = userType;
            }
            return userType;
        }
        /*
            * Load settings data from settingsHome/TelemetrySettings.json
            */
        static loadSettings() {
            try {
                TelemetryUtils.telemetrySettings = JSON.parse(fs.readFileSync(TelemetryUtils.telemetrySettingsFile));
            }
            catch (e) {
                // if file does not exist or fails to parse then assume no settings are saved and start over
                TelemetryUtils.telemetrySettings = {};
            }
            return TelemetryUtils.telemetrySettings;
        }
        /*
            * Save settings data in settingsHome/TelemetrySettings.json
            */
        static saveSettings() {
            let settingsHome = hostPlatform_1.HostPlatform.getSettingsHome();
            if (!fs.existsSync(settingsHome)) {
                fs.mkdirSync(settingsHome);
            }
            fs.writeFileSync(TelemetryUtils.telemetrySettingsFile, JSON.stringify(TelemetryUtils.telemetrySettings));
        }
    }
    TelemetryUtils.USERTYPE_INTERNAL = "Internal";
    TelemetryUtils.USERTYPE_EXTERNAL = "External";
    TelemetryUtils.TELEMETRY_SETTINGS_FILENAME = "VSCodeTelemetrySettings.json";
    TelemetryUtils.INTERNAL_DOMAIN_SUFFIX = "microsoft.com";
    TelemetryUtils.INTERNAL_USER_ENV_VAR = "TACOINTERNAL";
    /**
     * TelemetryEvent represents a basic telemetry data point
     */
    class TelemetryEvent {
        constructor(name, properties) {
            this.name = name;
            this.properties = properties || {};
            this.eventId = TelemetryUtils.generateGuid();
        }
        setPiiProperty(name, value) {
            let hmac = crypto.createHmac("sha256", new Buffer(TelemetryEvent.PII_HASH_KEY, "utf8"));
            let hashedValue = hmac.update(value).digest("hex");
            this.properties[name] = hashedValue;
            if (Telemetry.isInternal()) {
                this.properties[name + ".nothashed"] = value;
            }
        }
    }
    TelemetryEvent.PII_HASH_KEY = "959069c9-9e93-4fa1-bf16-3f8120d7db0c";
    Telemetry.TelemetryEvent = TelemetryEvent;
    /**
     * TelemetryActivity automatically includes timing data, used for scenarios where we want to track performance.
     * Calls to start() and end() are optional, if not called explicitly then the constructor will be the start and send will be the end.
     * This event will include a property called reserved.activity.duration which represents time in milliseconds.
     */
    class TelemetryActivity extends TelemetryEvent {
        constructor(name, properties) {
            super(name, properties);
            this.start();
        }
        start() {
            this.startTime = process.hrtime();
        }
        end() {
            if (!this.endTime) {
                this.endTime = process.hrtime(this.startTime);
                // convert [seconds, nanoseconds] to milliseconds and include as property
                this.properties["reserved.activity.duration"] = this.endTime[0] * 1000 + this.endTime[1] / 1000000;
            }
        }
    }
    Telemetry.TelemetryActivity = TelemetryActivity;
    function init(appNameValue, appVersion, reporterToUse) {
        try {
            Telemetry.appName = appNameValue;
            TelemetryUtils.init(appVersion, reporterToUse);
        }
        catch (err) {
            console.error(err);
        }
    }
    Telemetry.init = init;
    function send(event, ignoreOptIn = false) {
        if (Telemetry.isOptedIn || ignoreOptIn) {
            TelemetryUtils.addCommonProperties(event);
            try {
                if (event instanceof TelemetryActivity) {
                    event.end();
                }
                if (Telemetry.reporter) {
                    let properties = {};
                    let measures = {};
                    Object.keys(event.properties || {}).forEach(function (key) {
                        switch (typeof event.properties[key]) {
                            case "string":
                                properties[key] = event.properties[key];
                                break;
                            case "number":
                                measures[key] = event.properties[key];
                                break;
                            default:
                                properties[key] = JSON.stringify(event.properties[key]);
                                break;
                        }
                    });
                    Telemetry.reporter.sendTelemetryEvent(event.name, properties, measures);
                }
            }
            catch (err) {
                console.error(err);
            }
        }
    }
    Telemetry.send = send;
    function isInternal() {
        return TelemetryUtils.userType === TelemetryUtils.USERTYPE_INTERNAL;
    }
    Telemetry.isInternal = isInternal;
    function getSessionId() {
        return TelemetryUtils.sessionId;
    }
    Telemetry.getSessionId = getSessionId;
    function setSessionId(sessionId) {
        TelemetryUtils.sessionId = sessionId;
    }
    Telemetry.setSessionId = setSessionId;
    Telemetry.APPINSIGHTS_INSTRUMENTATIONKEY = "AIF-d9b70cd4-b9f9-4d70-929b-a071c400b217"; // Matches vscode telemetry key
    function defaultTelemetryReporter(appVersion) {
        // BEGIN MODIFIED BY PELMERS
        const TelemetryReporter = {
            sendTelemetryEvent: (_args) => { }
        };
        return TelemetryReporter;
        // END MODIFIED BY PELMERS
    }
    Telemetry.defaultTelemetryReporter = defaultTelemetryReporter;
    function sendExtensionTelemetry(extensionId, extensionVersion, appInsightsKey, eventName, properties, measures) {
        let extensionTelemetryReporter = Telemetry.reporterDictionary[extensionId];
        if (!extensionTelemetryReporter) {
            let TelemetryReporter = require("vscode-extension-telemetry").default;
            Telemetry.reporterDictionary[extensionId] = new TelemetryReporter(extensionId, extensionVersion, appInsightsKey);
            extensionTelemetryReporter = Telemetry.reporterDictionary[extensionId];
        }
        extensionTelemetryReporter.sendTelemetryEvent(eventName, properties, measures);
    }
    Telemetry.sendExtensionTelemetry = sendExtensionTelemetry;
})(Telemetry = exports.Telemetry || (exports.Telemetry = {}));

//# sourceMappingURL=telemetry.js.map
