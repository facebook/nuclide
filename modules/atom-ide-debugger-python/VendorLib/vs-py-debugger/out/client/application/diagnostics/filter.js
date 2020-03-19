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
const types_1 = require("../../common/types");
const types_2 = require("../../ioc/types");
const types_3 = require("./types");
var FilterKeys;
(function (FilterKeys) {
    FilterKeys["GlobalDiagnosticFilter"] = "GLOBAL_DIAGNOSTICS_FILTER";
    FilterKeys["WorkspaceDiagnosticFilter"] = "WORKSPACE_DIAGNOSTICS_FILTER";
})(FilterKeys = exports.FilterKeys || (exports.FilterKeys = {}));
let DiagnosticFilterService = class DiagnosticFilterService {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
    }
    shouldIgnoreDiagnostic(code) {
        return __awaiter(this, void 0, void 0, function* () {
            const factory = this.serviceContainer.get(types_1.IPersistentStateFactory);
            const globalState = factory.createGlobalPersistentState(FilterKeys.GlobalDiagnosticFilter, []);
            const workspaceState = factory.createWorkspacePersistentState(FilterKeys.WorkspaceDiagnosticFilter, []);
            return globalState.value.indexOf(code) >= 0 ||
                workspaceState.value.indexOf(code) >= 0;
        });
    }
    ignoreDiagnostic(code, scope) {
        return __awaiter(this, void 0, void 0, function* () {
            const factory = this.serviceContainer.get(types_1.IPersistentStateFactory);
            const state = scope === types_3.DiagnosticScope.Global ?
                factory.createGlobalPersistentState(FilterKeys.GlobalDiagnosticFilter, []) :
                factory.createWorkspacePersistentState(FilterKeys.WorkspaceDiagnosticFilter, []);
            const currentValue = state.value.slice();
            yield state.updateValue(currentValue.concat(code));
        });
    }
};
DiagnosticFilterService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_2.IServiceContainer))
], DiagnosticFilterService);
exports.DiagnosticFilterService = DiagnosticFilterService;
//# sourceMappingURL=filter.js.map