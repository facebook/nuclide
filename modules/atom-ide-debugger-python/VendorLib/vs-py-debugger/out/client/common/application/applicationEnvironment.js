// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("inversify");
const path = require("path");
const vscode = require("vscode");
const constants_1 = require("../constants");
let ApplicationEnvironment = class ApplicationEnvironment {
    get appName() {
        return vscode.env.appName;
    }
    get appRoot() {
        return vscode.env.appRoot;
    }
    get language() {
        return vscode.env.language;
    }
    get sessionId() {
        return vscode.env.sessionId;
    }
    get machineId() {
        return vscode.env.machineId;
    }
    get extensionName() {
        // tslint:disable-next-line:non-literal-require
        return require(path.join(constants_1.EXTENSION_ROOT_DIR, 'package.json')).displayName;
    }
    // tslint:disable-next-line:no-any
    get packageJson() {
        // tslint:disable-next-line:non-literal-require
        return require(path.join(constants_1.EXTENSION_ROOT_DIR, 'package.json'));
    }
};
ApplicationEnvironment = __decorate([
    inversify_1.injectable()
], ApplicationEnvironment);
exports.ApplicationEnvironment = ApplicationEnvironment;
//# sourceMappingURL=applicationEnvironment.js.map