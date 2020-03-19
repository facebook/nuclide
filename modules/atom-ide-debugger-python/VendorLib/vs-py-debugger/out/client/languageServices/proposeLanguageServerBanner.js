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
const vscode_1 = require("vscode");
const types_1 = require("../common/application/types");
require("../common/extensions");
const types_2 = require("../common/types");
const random_1 = require("../common/utils/random");
// persistent state names, exported to make use of in testing
var ProposeLSStateKeys;
(function (ProposeLSStateKeys) {
    ProposeLSStateKeys["ShowBanner"] = "ProposeLSBanner";
})(ProposeLSStateKeys = exports.ProposeLSStateKeys || (exports.ProposeLSStateKeys = {}));
var ProposeLSLabelIndex;
(function (ProposeLSLabelIndex) {
    ProposeLSLabelIndex[ProposeLSLabelIndex["Yes"] = 0] = "Yes";
    ProposeLSLabelIndex[ProposeLSLabelIndex["No"] = 1] = "No";
    ProposeLSLabelIndex[ProposeLSLabelIndex["Later"] = 2] = "Later";
})(ProposeLSLabelIndex || (ProposeLSLabelIndex = {}));
/*
This class represents a popup that propose that the user try out a new
feature of the extension, and optionally enable that new feature if they
choose to do so. It is meant to be shown only to a subset of our users,
and will show as soon as it is instructed to do so, if a random sample
function enables the popup for this user.
*/
let ProposeLanguageServerBanner = class ProposeLanguageServerBanner {
    constructor(appShell, persistentState, configuration, sampleSizePerOneHundredUsers = 10) {
        this.appShell = appShell;
        this.persistentState = persistentState;
        this.configuration = configuration;
        this.disabledInCurrentSession = false;
        this.bannerMessage = 'Try out Preview of our new Python Language Server to get richer and faster IntelliSense completions, and syntax errors as you type.';
        this.bannerLabels = ['Try it now', 'No thanks', 'Remind me Later'];
        this.sampleSizePerHundred = sampleSizePerOneHundredUsers;
        this.initialize();
    }
    initialize() {
        if (this.initialized) {
            return;
        }
        this.initialized = true;
        // Don't even bother adding handlers if banner has been turned off.
        if (!this.enabled) {
            return;
        }
        // we only want 10% of folks that use Jedi to see this survey.
        const randomSample = random_1.getRandomBetween(0, 100);
        if (randomSample >= this.sampleSizePerHundred) {
            this.disable().ignoreErrors();
            return;
        }
    }
    get shownCount() {
        return Promise.resolve(-1); // we don't count this popup banner!
    }
    get optionLabels() {
        return this.bannerLabels;
    }
    get enabled() {
        return this.persistentState.createGlobalPersistentState(ProposeLSStateKeys.ShowBanner, true).value;
    }
    showBanner() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.enabled) {
                return;
            }
            const show = yield this.shouldShowBanner();
            if (!show) {
                return;
            }
            const response = yield this.appShell.showInformationMessage(this.bannerMessage, ...this.bannerLabels);
            switch (response) {
                case this.bannerLabels[ProposeLSLabelIndex.Yes]: {
                    yield this.enableNewLanguageServer();
                    yield this.disable();
                    break;
                }
                case this.bannerLabels[ProposeLSLabelIndex.No]: {
                    yield this.disable();
                    break;
                }
                case this.bannerLabels[ProposeLSLabelIndex.Later]: {
                    this.disabledInCurrentSession = true;
                    break;
                }
                default: {
                    // Disable for the current session.
                    this.disabledInCurrentSession = true;
                }
            }
        });
    }
    shouldShowBanner() {
        return __awaiter(this, void 0, void 0, function* () {
            return Promise.resolve(this.enabled && !this.disabledInCurrentSession);
        });
    }
    disable() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.persistentState.createGlobalPersistentState(ProposeLSStateKeys.ShowBanner, false).updateValue(false);
        });
    }
    enableNewLanguageServer() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.configuration.updateSetting('jediEnabled', false, undefined, vscode_1.ConfigurationTarget.Global);
        });
    }
};
ProposeLanguageServerBanner = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IApplicationShell)),
    __param(1, inversify_1.inject(types_2.IPersistentStateFactory)),
    __param(2, inversify_1.inject(types_2.IConfigurationService))
], ProposeLanguageServerBanner);
exports.ProposeLanguageServerBanner = ProposeLanguageServerBanner;
//# sourceMappingURL=proposeLanguageServerBanner.js.map