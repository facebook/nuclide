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
const types_1 = require("../../common/application/types");
require("../../common/extensions");
const types_2 = require("../../common/types");
const types_3 = require("../../ioc/types");
const constants_1 = require("../constants");
const SAMPLE_SIZE_PER_HUNDRED = 10;
var PersistentStateKeys;
(function (PersistentStateKeys) {
    PersistentStateKeys["ShowBanner"] = "ShowBanner";
    PersistentStateKeys["DebuggerLaunchCounter"] = "DebuggerLaunchCounter";
    PersistentStateKeys["DebuggerLaunchThresholdCounter"] = "DebuggerLaunchThresholdCounter";
    PersistentStateKeys["UserSelected"] = "DebuggerUserSelected";
})(PersistentStateKeys = exports.PersistentStateKeys || (exports.PersistentStateKeys = {}));
let DebuggerBanner = class DebuggerBanner {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
    }
    initialize() {
        if (this.initialized) {
            return;
        }
        this.initialized = true;
        // Don't even bother adding handlers if banner has been turned off.
        if (!this.isEnabled()) {
            return;
        }
        this.addCallback();
    }
    // "enabled" state
    isEnabled() {
        const factory = this.serviceContainer.get(types_2.IPersistentStateFactory);
        const key = PersistentStateKeys.ShowBanner;
        const state = factory.createGlobalPersistentState(key, true);
        return state.value;
    }
    disable() {
        return __awaiter(this, void 0, void 0, function* () {
            const factory = this.serviceContainer.get(types_2.IPersistentStateFactory);
            const key = PersistentStateKeys.ShowBanner;
            const state = factory.createGlobalPersistentState(key, false);
            yield state.updateValue(false);
        });
    }
    // showing banner
    shouldShow() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isEnabled() || this.disabledInCurrentSession) {
                return false;
            }
            if (!(yield this.passedThreshold())) {
                return false;
            }
            return this.isUserSelected();
        });
    }
    show() {
        return __awaiter(this, void 0, void 0, function* () {
            const appShell = this.serviceContainer.get(types_1.IApplicationShell);
            const msg = 'Can you please take 2 minutes to tell us how the debugger is working for you?';
            const yes = 'Yes, take survey now';
            const no = 'No thanks';
            const later = 'Remind me later';
            const response = yield appShell.showInformationMessage(msg, yes, no, later);
            switch (response) {
                case yes:
                    {
                        yield this.action();
                        yield this.disable();
                        break;
                    }
                case no: {
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
    action() {
        return __awaiter(this, void 0, void 0, function* () {
            const debuggerLaunchCounter = yield this.getGetDebuggerLaunchCounter();
            const browser = this.serviceContainer.get(types_2.IBrowserService);
            browser.launch(`https://www.research.net/r/N7B25RV?n=${debuggerLaunchCounter}`);
        });
    }
    // user selection
    isUserSelected() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.userSelected !== undefined) {
                return this.userSelected;
            }
            const factory = this.serviceContainer.get(types_2.IPersistentStateFactory);
            const key = PersistentStateKeys.UserSelected;
            const state = factory.createGlobalPersistentState(key, undefined);
            let selected = state.value;
            if (selected === undefined) {
                const runtime = this.serviceContainer.get(types_2.IRandom);
                const randomSample = runtime.getRandomInt(0, 100);
                selected = randomSample < SAMPLE_SIZE_PER_HUNDRED;
                state.updateValue(selected).ignoreErrors();
            }
            this.userSelected = selected;
            return selected;
        });
    }
    // persistent counter
    passedThreshold() {
        return __awaiter(this, void 0, void 0, function* () {
            const [threshold, debuggerCounter] = yield Promise.all([
                this.getDebuggerLaunchThresholdCounter(),
                this.getGetDebuggerLaunchCounter()
            ]);
            return debuggerCounter >= threshold;
        });
    }
    incrementDebuggerLaunchCounter() {
        return __awaiter(this, void 0, void 0, function* () {
            const factory = this.serviceContainer.get(types_2.IPersistentStateFactory);
            const key = PersistentStateKeys.DebuggerLaunchCounter;
            const state = factory.createGlobalPersistentState(key, 0);
            yield state.updateValue(state.value + 1);
        });
    }
    getGetDebuggerLaunchCounter() {
        return __awaiter(this, void 0, void 0, function* () {
            const factory = this.serviceContainer.get(types_2.IPersistentStateFactory);
            const key = PersistentStateKeys.DebuggerLaunchCounter;
            const state = factory.createGlobalPersistentState(key, 0);
            return state.value;
        });
    }
    getDebuggerLaunchThresholdCounter() {
        return __awaiter(this, void 0, void 0, function* () {
            const factory = this.serviceContainer.get(types_2.IPersistentStateFactory);
            const key = PersistentStateKeys.DebuggerLaunchThresholdCounter;
            const state = factory.createGlobalPersistentState(key, undefined);
            if (state.value === undefined) {
                const runtime = this.serviceContainer.get(types_2.IRandom);
                const randomNumber = runtime.getRandomInt(1, 11);
                yield state.updateValue(randomNumber);
            }
            return state.value;
        });
    }
    // debugger-specific functionality
    addCallback() {
        const debuggerService = this.serviceContainer.get(types_1.IDebugService);
        const disposable = debuggerService.onDidTerminateDebugSession((e) => __awaiter(this, void 0, void 0, function* () {
            if (e.type === constants_1.DebuggerTypeName) {
                const logger = this.serviceContainer.get(types_2.ILogger);
                yield this.onDidTerminateDebugSession()
                    .catch(ex => logger.logError('Error in debugger Banner', ex));
            }
        }));
        this.serviceContainer.get(types_2.IDisposableRegistry).push(disposable);
    }
    onDidTerminateDebugSession() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isEnabled()) {
                return;
            }
            yield this.incrementDebuggerLaunchCounter();
            const show = yield this.shouldShow();
            if (!show) {
                return;
            }
            yield this.show();
        });
    }
};
DebuggerBanner = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_3.IServiceContainer))
], DebuggerBanner);
exports.DebuggerBanner = DebuggerBanner;
//# sourceMappingURL=banner.js.map