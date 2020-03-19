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
const types_1 = require("../common/types");
const types_2 = require("../ioc/types");
const lastCheckedForLSDateTimeCacheKey = 'LS.LAST.CHECK.TIME';
const frequencyForBetalLSDownloadCheck = 1000 * 60 * 60 * 24; // One day.
let DownloadDailyChannelRule = class DownloadDailyChannelRule {
    shouldLookForNewLanguageServer(currentFolder) {
        return __awaiter(this, void 0, void 0, function* () {
            return true;
        });
    }
};
DownloadDailyChannelRule = __decorate([
    inversify_1.injectable()
], DownloadDailyChannelRule);
exports.DownloadDailyChannelRule = DownloadDailyChannelRule;
let DownloadStableChannelRule = class DownloadStableChannelRule {
    shouldLookForNewLanguageServer(currentFolder) {
        return __awaiter(this, void 0, void 0, function* () {
            return currentFolder ? false : true;
        });
    }
};
DownloadStableChannelRule = __decorate([
    inversify_1.injectable()
], DownloadStableChannelRule);
exports.DownloadStableChannelRule = DownloadStableChannelRule;
let DownloadBetaChannelRule = class DownloadBetaChannelRule {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
    }
    shouldLookForNewLanguageServer(currentFolder) {
        return __awaiter(this, void 0, void 0, function* () {
            // For beta, we do this only once a day.
            const stateFactory = this.serviceContainer.get(types_1.IPersistentStateFactory);
            const globalState = stateFactory.createGlobalPersistentState(lastCheckedForLSDateTimeCacheKey, true, frequencyForBetalLSDownloadCheck);
            // If we haven't checked it in the last 24 hours, then ensure we don't do it again.
            if (globalState.value) {
                yield globalState.updateValue(false);
                return true;
            }
            return !currentFolder || globalState.value;
        });
    }
};
DownloadBetaChannelRule = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_2.IServiceContainer))
], DownloadBetaChannelRule);
exports.DownloadBetaChannelRule = DownloadBetaChannelRule;
//# sourceMappingURL=downloadChannelRules.js.map