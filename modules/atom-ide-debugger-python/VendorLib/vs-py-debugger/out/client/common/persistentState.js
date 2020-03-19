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
const types_1 = require("./types");
class PersistentState {
    constructor(storage, key, defaultValue, expiryDurationMs) {
        this.storage = storage;
        this.key = key;
        this.defaultValue = defaultValue;
        this.expiryDurationMs = expiryDurationMs;
    }
    get value() {
        if (this.expiryDurationMs) {
            const cachedData = this.storage.get(this.key, { data: this.defaultValue });
            if (!cachedData || !cachedData.expiry || cachedData.expiry < Date.now()) {
                return this.defaultValue;
            }
            else {
                return cachedData.data;
            }
        }
        else {
            return this.storage.get(this.key, this.defaultValue);
        }
    }
    updateValue(newValue) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.expiryDurationMs) {
                yield this.storage.update(this.key, { data: newValue, expiry: Date.now() + this.expiryDurationMs });
            }
            else {
                yield this.storage.update(this.key, newValue);
            }
        });
    }
}
let PersistentStateFactory = class PersistentStateFactory {
    constructor(globalState, workspaceState) {
        this.globalState = globalState;
        this.workspaceState = workspaceState;
    }
    createGlobalPersistentState(key, defaultValue, expiryDurationMs) {
        return new PersistentState(this.globalState, key, defaultValue, expiryDurationMs);
    }
    createWorkspacePersistentState(key, defaultValue, expiryDurationMs) {
        return new PersistentState(this.workspaceState, key, defaultValue, expiryDurationMs);
    }
};
PersistentStateFactory = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IMemento)), __param(0, inversify_1.named(types_1.GLOBAL_MEMENTO)),
    __param(1, inversify_1.inject(types_1.IMemento)), __param(1, inversify_1.named(types_1.WORKSPACE_MEMENTO))
], PersistentStateFactory);
exports.PersistentStateFactory = PersistentStateFactory;
//# sourceMappingURL=persistentState.js.map