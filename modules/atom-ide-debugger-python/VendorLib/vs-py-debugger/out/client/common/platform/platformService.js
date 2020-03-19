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
const platform = require("../utils/platform");
const osinfo = require("./osinfo");
let PlatformService = class PlatformService {
    get info() {
        if (!this.cached) {
            this.cached = platform.getInfo();
        }
        return this.cached;
    }
    get pathVariableName() {
        return osinfo.getPathVariableName(this.info);
    }
    get virtualEnvBinName() {
        return osinfo.getVirtualEnvBinName(this.info);
    }
    // convenience methods
    get isWindows() {
        return platform.isWindows(this.info);
    }
    get isMac() {
        return platform.isMac(this.info);
    }
    get isLinux() {
        return platform.isLinux(this.info);
    }
    get is64bit() {
        return platform.is64bit(this.info);
    }
};
PlatformService = __decorate([
    inversify_1.injectable()
], PlatformService);
exports.PlatformService = PlatformService;
//# sourceMappingURL=platformService.js.map