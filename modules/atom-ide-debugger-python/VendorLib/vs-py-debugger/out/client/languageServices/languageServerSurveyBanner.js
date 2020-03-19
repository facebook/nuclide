// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("inversify");
const types_1 = require("../activation/types");
const types_2 = require("../common/application/types");
require("../common/extensions");
const types_3 = require("../common/types");
const localize = require("../common/utils/localize");
const random_1 = require("../common/utils/random");
// persistent state names, exported to make use of in testing
var LSSurveyStateKeys;
(function (LSSurveyStateKeys) {
    LSSurveyStateKeys["ShowBanner"] = "ShowLSSurveyBanner";
    LSSurveyStateKeys["ShowAttemptCounter"] = "LSSurveyShowAttempt";
    LSSurveyStateKeys["ShowAfterCompletionCount"] = "LSSurveyShowCount";
})(LSSurveyStateKeys = exports.LSSurveyStateKeys || (exports.LSSurveyStateKeys = {}));
var LSSurveyLabelIndex;
(function (LSSurveyLabelIndex) {
    LSSurveyLabelIndex[LSSurveyLabelIndex["Yes"] = 0] = "Yes";
    LSSurveyLabelIndex[LSSurveyLabelIndex["No"] = 1] = "No";
})(LSSurveyLabelIndex || (LSSurveyLabelIndex = {}));
/*
This class represents a popup that will ask our users for some feedback after
a specific event occurs N times.
*/
let LanguageServerSurveyBanner = class LanguageServerSurveyBanner {
    constructor(appShell, persistentState, browserService, lsService, showAfterMinimumEventsCount = 100, showBeforeMaximumEventsCount = 500) {
        this.appShell = appShell;
        this.persistentState = persistentState;
        this.browserService = browserService;
        this.lsService = lsService;
        this.disabledInCurrentSession = false;
        this.isInitialized = false;
        this.bannerMessage = localize.LanguageServiceSurveyBanner.bannerMessage();
        this.bannerLabels = [localize.LanguageServiceSurveyBanner.bannerLabelYes(), localize.LanguageServiceSurveyBanner.bannerLabelNo()];
        this.minCompletionsBeforeShow = showAfterMinimumEventsCount;
        this.maxCompletionsBeforeShow = showBeforeMaximumEventsCount;
        this.initialize();
    }
    initialize() {
        if (this.isInitialized) {
            return;
        }
        this.isInitialized = true;
        if (this.minCompletionsBeforeShow >= this.maxCompletionsBeforeShow) {
            this.disable().ignoreErrors();
        }
    }
    get optionLabels() {
        return this.bannerLabels;
    }
    get shownCount() {
        return this.getPythonLSLaunchCounter();
    }
    get enabled() {
        return this.persistentState.createGlobalPersistentState(LSSurveyStateKeys.ShowBanner, true).value;
    }
    showBanner() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.enabled || this.disabledInCurrentSession) {
                return;
            }
            const launchCounter = yield this.incrementPythonLanguageServiceLaunchCounter();
            const show = yield this.shouldShowBanner(launchCounter);
            if (!show) {
                return;
            }
            const response = yield this.appShell.showInformationMessage(this.bannerMessage, ...this.bannerLabels);
            switch (response) {
                case this.bannerLabels[LSSurveyLabelIndex.Yes]:
                    {
                        yield this.launchSurvey();
                        yield this.disable();
                        break;
                    }
                case this.bannerLabels[LSSurveyLabelIndex.No]: {
                    yield this.disable();
                    break;
                }
                default: {
                    // Disable for the current session.
                    this.disabledInCurrentSession = true;
                }
            }
        });
    }
    shouldShowBanner(launchCounter) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.enabled || this.disabledInCurrentSession) {
                return false;
            }
            if (!launchCounter) {
                launchCounter = yield this.getPythonLSLaunchCounter();
            }
            const threshold = yield this.getPythonLSLaunchThresholdCounter();
            return launchCounter >= threshold;
        });
    }
    disable() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.persistentState.createGlobalPersistentState(LSSurveyStateKeys.ShowBanner, false).updateValue(false);
        });
    }
    launchSurvey() {
        return __awaiter(this, void 0, void 0, function* () {
            const launchCounter = yield this.getPythonLSLaunchCounter();
            let lsVersion = yield this.getPythonLSVersion();
            lsVersion = encodeURIComponent(lsVersion);
            this.browserService.launch(`https://www.research.net/r/LJZV9BZ?n=${launchCounter}&v=${lsVersion}`);
        });
    }
    incrementPythonLanguageServiceLaunchCounter() {
        return __awaiter(this, void 0, void 0, function* () {
            const state = this.persistentState.createGlobalPersistentState(LSSurveyStateKeys.ShowAttemptCounter, 0);
            yield state.updateValue(state.value + 1);
            return state.value;
        });
    }
    getPythonLSVersion(fallback = 'unknown') {
        return __awaiter(this, void 0, void 0, function* () {
            const langServiceLatestFolder = yield this.lsService.getCurrentLanguageServerDirectory();
            return langServiceLatestFolder ? langServiceLatestFolder.version.raw : fallback;
        });
    }
    getPythonLSLaunchCounter() {
        return __awaiter(this, void 0, void 0, function* () {
            const state = this.persistentState.createGlobalPersistentState(LSSurveyStateKeys.ShowAttemptCounter, 0);
            return state.value;
        });
    }
    getPythonLSLaunchThresholdCounter() {
        return __awaiter(this, void 0, void 0, function* () {
            const state = this.persistentState.createGlobalPersistentState(LSSurveyStateKeys.ShowAfterCompletionCount, undefined);
            if (state.value === undefined) {
                yield state.updateValue(random_1.getRandomBetween(this.minCompletionsBeforeShow, this.maxCompletionsBeforeShow));
            }
            return state.value;
        });
    }
};
LanguageServerSurveyBanner = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_2.IApplicationShell)),
    __param(1, inversify_1.inject(types_3.IPersistentStateFactory)),
    __param(2, inversify_1.inject(types_3.IBrowserService)),
    __param(3, inversify_1.inject(types_1.ILanguageServerFolderService))
], LanguageServerSurveyBanner);
exports.LanguageServerSurveyBanner = LanguageServerSurveyBanner;
//# sourceMappingURL=languageServerSurveyBanner.js.map