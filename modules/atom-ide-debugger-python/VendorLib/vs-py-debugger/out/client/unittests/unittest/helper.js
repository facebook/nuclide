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
const types_1 = require("../../ioc/types");
const types_2 = require("../types");
let UnitTestHelper = class UnitTestHelper {
    constructor(serviceContainer) {
        this.argsHelper = serviceContainer.get(types_2.IArgumentsHelper);
    }
    getStartDirectory(args) {
        const shortValue = this.argsHelper.getOptionValues(args, '-s');
        if (typeof shortValue === 'string') {
            return shortValue;
        }
        const longValue = this.argsHelper.getOptionValues(args, '--start-directory');
        if (typeof longValue === 'string') {
            return longValue;
        }
        return '.';
    }
    getIdsOfTestsToRun(tests, testsToRun) {
        const testIds = [];
        if (testsToRun && testsToRun.testFolder) {
            // Get test ids of files in these folders.
            testsToRun.testFolder.forEach(folder => {
                tests.testFiles.forEach(f => {
                    if (f.fullPath.startsWith(folder.name)) {
                        testIds.push(f.nameToRun);
                    }
                });
            });
        }
        if (testsToRun && testsToRun.testFile) {
            testIds.push(...testsToRun.testFile.map(f => f.nameToRun));
        }
        if (testsToRun && testsToRun.testSuite) {
            testIds.push(...testsToRun.testSuite.map(f => f.nameToRun));
        }
        if (testsToRun && testsToRun.testFunction) {
            testIds.push(...testsToRun.testFunction.map(f => f.nameToRun));
        }
        return testIds;
    }
};
UnitTestHelper = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IServiceContainer))
], UnitTestHelper);
exports.UnitTestHelper = UnitTestHelper;
//# sourceMappingURL=helper.js.map