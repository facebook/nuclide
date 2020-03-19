"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
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
const path = require("path");
const types_1 = require("../../platform/types");
const types_2 = require("../../types");
let BaseActivationCommandProvider = class BaseActivationCommandProvider {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
    }
    getActivationCommands(resource, targetShell) {
        const pythonPath = this.serviceContainer.get(types_2.IConfigurationService).getSettings(resource).pythonPath;
        return this.getActivationCommandsForInterpreter(pythonPath, targetShell);
    }
    findScriptFile(pythonPath, scriptFileNames) {
        return __awaiter(this, void 0, void 0, function* () {
            const fs = this.serviceContainer.get(types_1.IFileSystem);
            for (const scriptFileName of scriptFileNames) {
                // Generate scripts are found in the same directory as the interpreter.
                const scriptFile = path.join(path.dirname(pythonPath), scriptFileName);
                const found = yield fs.fileExists(scriptFile);
                if (found) {
                    return scriptFile;
                }
            }
        });
    }
};
BaseActivationCommandProvider = __decorate([
    inversify_1.injectable()
], BaseActivationCommandProvider);
exports.BaseActivationCommandProvider = BaseActivationCommandProvider;
//# sourceMappingURL=baseActivationProvider.js.map