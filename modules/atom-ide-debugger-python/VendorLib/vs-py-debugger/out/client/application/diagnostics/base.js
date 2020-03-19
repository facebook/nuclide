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
let BaseDiagnostic = class BaseDiagnostic {
    constructor(code, message, severity, scope) {
        this.code = code;
        this.message = message;
        this.severity = severity;
        this.scope = scope;
    }
};
BaseDiagnostic = __decorate([
    inversify_1.injectable()
], BaseDiagnostic);
exports.BaseDiagnostic = BaseDiagnostic;
let BaseDiagnosticsService = class BaseDiagnosticsService {
    constructor(supportedDiagnosticCodes, serviceContainer) {
        this.supportedDiagnosticCodes = supportedDiagnosticCodes;
        this.serviceContainer = serviceContainer;
        this.filterService = serviceContainer.get(types_1.IDiagnosticFilterService);
    }
    canHandle(diagnostic) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.supportedDiagnosticCodes.filter(item => item === diagnostic.code).length > 0;
        });
    }
};
BaseDiagnosticsService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.unmanaged()),
    __param(1, inversify_1.unmanaged())
], BaseDiagnosticsService);
exports.BaseDiagnosticsService = BaseDiagnosticsService;
//# sourceMappingURL=base.js.map