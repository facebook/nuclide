"use strict";
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
const vscode_1 = require("vscode");
const types_1 = require("../../common/types");
const types_2 = require("../../ioc/types");
const constants_1 = require("../common/constants");
const baseTestManager_1 = require("../common/managers/baseTestManager");
const types_3 = require("../common/types");
const types_4 = require("../types");
let TestManager = class TestManager extends baseTestManager_1.BaseTestManager {
    constructor(workspaceFolder, rootDirectory, serviceContainer) {
        super(constants_1.NOSETEST_PROVIDER, types_1.Product.nosetest, workspaceFolder, rootDirectory, serviceContainer);
        this.argsService = this.serviceContainer.get(types_4.IArgumentsService, this.testProvider);
        this.helper = this.serviceContainer.get(types_3.ITestsHelper);
        this.runner = this.serviceContainer.get(types_4.ITestManagerRunner, this.testProvider);
    }
    get enabled() {
        return this.settings.unitTest.nosetestsEnabled;
    }
    getDiscoveryOptions(ignoreCache) {
        const args = this.settings.unitTest.nosetestArgs.slice(0);
        return {
            workspaceFolder: this.workspaceFolder,
            cwd: this.rootDirectory, args,
            token: this.testDiscoveryCancellationToken, ignoreCache,
            outChannel: this.outputChannel
        };
    }
    runTestImpl(tests, testsToRun, runFailedTests, debug) {
        let args;
        const runAllTests = this.helper.shouldRunAllTests(testsToRun);
        if (debug) {
            args = this.argsService.filterArguments(this.settings.unitTest.nosetestArgs, runAllTests ? types_4.TestFilter.debugAll : types_4.TestFilter.debugSpecific);
        }
        else {
            args = this.argsService.filterArguments(this.settings.unitTest.nosetestArgs, runAllTests ? types_4.TestFilter.runAll : types_4.TestFilter.runSpecific);
        }
        if (runFailedTests === true && args.indexOf('--failed') === -1) {
            args.splice(0, 0, '--failed');
        }
        if (!runFailedTests && args.indexOf('--with-id') === -1) {
            args.splice(0, 0, '--with-id');
        }
        const options = {
            workspaceFolder: vscode_1.Uri.file(this.rootDirectory),
            cwd: this.rootDirectory,
            tests, args, testsToRun,
            token: this.testRunnerCancellationToken,
            outChannel: this.outputChannel,
            debug
        };
        return this.runner.runTest(this.testResultsService, options, this);
    }
};
TestManager = __decorate([
    inversify_1.injectable(),
    __param(2, inversify_1.inject(types_2.IServiceContainer))
], TestManager);
exports.TestManager = TestManager;
//# sourceMappingURL=main.js.map