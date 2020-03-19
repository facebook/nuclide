"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
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
const types_1 = require("../../../ioc/types");
const constants_1 = require("../../common/constants");
const types_2 = require("../../common/types");
const types_3 = require("../../types");
let TestDiscoveryService = class TestDiscoveryService {
    constructor(serviceContainer, testParser) {
        this.serviceContainer = serviceContainer;
        this.testParser = testParser;
        this.argsService = this.serviceContainer.get(types_3.IArgumentsService, constants_1.NOSETEST_PROVIDER);
        this.runner = this.serviceContainer.get(types_2.ITestRunner);
    }
    discoverTests(options) {
        return __awaiter(this, void 0, void 0, function* () {
            // Remove unwanted arguments.
            const args = this.argsService.filterArguments(options.args, types_3.TestFilter.discovery);
            const token = options.token ? options.token : new vscode_1.CancellationTokenSource().token;
            const runOptions = {
                args: ['--collect-only', '-vvv'].concat(args),
                cwd: options.cwd,
                workspaceFolder: options.workspaceFolder,
                token,
                outChannel: options.outChannel
            };
            const data = yield this.runner.run(constants_1.NOSETEST_PROVIDER, runOptions);
            if (options.token && options.token.isCancellationRequested) {
                return Promise.reject('cancelled');
            }
            return this.testParser.parse(data, options);
        });
    }
};
TestDiscoveryService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IServiceContainer)),
    __param(1, inversify_1.inject(types_2.ITestsParser)), __param(1, inversify_1.named(constants_1.NOSETEST_PROVIDER))
], TestDiscoveryService);
exports.TestDiscoveryService = TestDiscoveryService;
//# sourceMappingURL=discoveryService.js.map