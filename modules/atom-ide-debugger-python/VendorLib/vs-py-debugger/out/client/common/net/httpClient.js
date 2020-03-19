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
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("inversify");
const request = require("request");
const types_1 = require("../../ioc/types");
const types_2 = require("../application/types");
let HttpClient = class HttpClient {
    constructor(serviceContainer) {
        const workspaceService = serviceContainer.get(types_2.IWorkspaceService);
        this.requestOptions = { proxy: workspaceService.getConfiguration('http').get('proxy', '') };
    }
    downloadFile(uri) {
        return request(uri, this.requestOptions);
    }
    getJSON(uri) {
        return new Promise((resolve, reject) => {
            request(uri, this.requestOptions, (ex, response, body) => {
                if (ex) {
                    return reject(ex);
                }
                if (response.statusCode !== 200) {
                    return reject(new Error(`Failed with status ${response.statusCode}, ${response.statusMessage}, Uri ${uri}`));
                }
                resolve(JSON.parse(body));
            });
        });
    }
};
HttpClient = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IServiceContainer))
], HttpClient);
exports.HttpClient = HttpClient;
//# sourceMappingURL=httpClient.js.map