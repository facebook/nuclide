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
const types_1 = require("../common/application/types");
require("../common/extensions");
const types_2 = require("../common/types");
const localize = require("../common/utils/localize");
var DSSurveyStateKeys;
(function (DSSurveyStateKeys) {
    DSSurveyStateKeys["ShowBanner"] = "ShowDSSurveyBanner";
    DSSurveyStateKeys["ShowAttemptCounter"] = "DSSurveyShowAttempt";
})(DSSurveyStateKeys = exports.DSSurveyStateKeys || (exports.DSSurveyStateKeys = {}));
var DSSurveyLabelIndex;
(function (DSSurveyLabelIndex) {
    DSSurveyLabelIndex[DSSurveyLabelIndex["Yes"] = 0] = "Yes";
    DSSurveyLabelIndex[DSSurveyLabelIndex["No"] = 1] = "No";
})(DSSurveyLabelIndex || (DSSurveyLabelIndex = {}));
let DataScienceSurveyBanner = class DataScienceSurveyBanner {
    constructor(appShell, persistentState, browserService, commandThreshold = 500, surveyLink = 'https://aka.ms/pyaisurvey') {
        this.appShell = appShell;
        this.persistentState = persistentState;
        this.browserService = browserService;
        this.disabledInCurrentSession = false;
        this.isInitialized = false;
        this.bannerMessage = localize.DataScienceSurveyBanner.bannerMessage();
        this.bannerLabels = [localize.DataScienceSurveyBanner.bannerLabelYes(), localize.DataScienceSurveyBanner.bannerLabelNo()];
        this.commandThreshold = commandThreshold;
        this.surveyLink = surveyLink;
        this.initialize();
    }
    initialize() {
        if (this.isInitialized) {
            return;
        }
        this.isInitialized = true;
    }
    get optionLabels() {
        return this.bannerLabels;
    }
    get shownCount() {
        return this.getPythonDSCommandCounter();
    }
    get enabled() {
        return this.persistentState.createGlobalPersistentState(DSSurveyStateKeys.ShowBanner, true).value;
    }
    showBanner() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.enabled || this.disabledInCurrentSession) {
                return;
            }
            const launchCounter = yield this.incrementPythonDataScienceCommandCounter();
            const show = yield this.shouldShowBanner(launchCounter);
            if (!show) {
                return;
            }
            const response = yield this.appShell.showInformationMessage(this.bannerMessage, ...this.bannerLabels);
            switch (response) {
                case this.bannerLabels[DSSurveyLabelIndex.Yes]:
                    {
                        yield this.launchSurvey();
                        yield this.disable();
                        break;
                    }
                case this.bannerLabels[DSSurveyLabelIndex.No]: {
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
                launchCounter = yield this.getPythonDSCommandCounter();
            }
            return launchCounter >= this.commandThreshold;
        });
    }
    disable() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.persistentState.createGlobalPersistentState(DSSurveyStateKeys.ShowBanner, false).updateValue(false);
        });
    }
    launchSurvey() {
        return __awaiter(this, void 0, void 0, function* () {
            this.browserService.launch(this.surveyLink);
        });
    }
    getPythonDSCommandCounter() {
        return __awaiter(this, void 0, void 0, function* () {
            const state = this.persistentState.createGlobalPersistentState(DSSurveyStateKeys.ShowAttemptCounter, 0);
            return state.value;
        });
    }
    incrementPythonDataScienceCommandCounter() {
        return __awaiter(this, void 0, void 0, function* () {
            const state = this.persistentState.createGlobalPersistentState(DSSurveyStateKeys.ShowAttemptCounter, 0);
            yield state.updateValue(state.value + 1);
            return state.value;
        });
    }
};
DataScienceSurveyBanner = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IApplicationShell)),
    __param(1, inversify_1.inject(types_2.IPersistentStateFactory)),
    __param(2, inversify_1.inject(types_2.IBrowserService))
], DataScienceSurveyBanner);
exports.DataScienceSurveyBanner = DataScienceSurveyBanner;
//# sourceMappingURL=dataScienceSurveyBanner.js.map