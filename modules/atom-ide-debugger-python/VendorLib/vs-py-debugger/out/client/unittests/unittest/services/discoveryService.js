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
const types_1 = require("../../../ioc/types");
const constants_1 = require("../../common/constants");
const types_2 = require("../../common/types");
const types_3 = require("../../types");
let TestDiscoveryService = class TestDiscoveryService {
    constructor(serviceContainer, testParser) {
        this.testParser = testParser;
        this.argsHelper = serviceContainer.get(types_3.IArgumentsHelper);
        this.runner = serviceContainer.get(types_2.ITestRunner);
    }
    discoverTests(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const pythonScript = this.getDiscoveryScript(options);
            const unitTestOptions = this.translateOptions(options);
            const runOptions = {
                args: ['-c', pythonScript],
                cwd: options.cwd,
                workspaceFolder: options.workspaceFolder,
                token: options.token,
                outChannel: options.outChannel
            };
            const data = yield this.runner.run(constants_1.UNITTEST_PROVIDER, runOptions);
            if (options.token && options.token.isCancellationRequested) {
                return Promise.reject('cancelled');
            }
            return this.testParser.parse(data, unitTestOptions);
        });
    }
    getDiscoveryScript(options) {
        const unitTestOptions = this.translateOptions(options);
        return `
import unittest
loader = unittest.TestLoader()
suites = loader.discover("${unitTestOptions.startDirectory}", pattern="${unitTestOptions.pattern}")
print("start") #Don't remove this line
for suite in suites._tests:
    for cls in suite._tests:
        try:
            for m in cls._tests:
                print(m.id())
        except:
            pass`;
    }
    translateOptions(options) {
        return Object.assign({}, options, { startDirectory: this.getStartDirectory(options), pattern: this.getTestPattern(options) });
    }
    getStartDirectory(options) {
        const shortValue = this.argsHelper.getOptionValues(options.args, '-s');
        if (typeof shortValue === 'string') {
            return shortValue;
        }
        const longValue = this.argsHelper.getOptionValues(options.args, '--start-directory');
        if (typeof longValue === 'string') {
            return longValue;
        }
        return '.';
    }
    getTestPattern(options) {
        const shortValue = this.argsHelper.getOptionValues(options.args, '-p');
        if (typeof shortValue === 'string') {
            return shortValue;
        }
        const longValue = this.argsHelper.getOptionValues(options.args, '--pattern');
        if (typeof longValue === 'string') {
            return longValue;
        }
        return 'test*.py';
    }
};
TestDiscoveryService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IServiceContainer)),
    __param(1, inversify_1.inject(types_2.ITestsParser)), __param(1, inversify_1.named(constants_1.UNITTEST_PROVIDER))
], TestDiscoveryService);
exports.TestDiscoveryService = TestDiscoveryService;
//# sourceMappingURL=discoveryService.js.map