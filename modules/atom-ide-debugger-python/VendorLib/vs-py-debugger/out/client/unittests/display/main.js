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
const vscode_1 = require("vscode");
const types_1 = require("../../common/application/types");
const constants = require("../../common/constants");
const helpers_1 = require("../../common/helpers");
const types_2 = require("../../common/types");
const misc_1 = require("../../common/utils/misc");
const types_3 = require("../../ioc/types");
const constants_1 = require("../common/constants");
const types_4 = require("../common/types");
let TestResultDisplay = class TestResultDisplay {
    // tslint:disable-next-line:no-any
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
        this.discoverCounter = 0;
        this.ticker = ['|', '/', '-', '|', '/', '-', '\\'];
        this._enabled = false;
        this.didChange = new vscode_1.EventEmitter();
        this.appShell = serviceContainer.get(types_1.IApplicationShell);
        this.statusBar = this.appShell.createStatusBarItem(vscode_1.StatusBarAlignment.Left);
        this.testsHelper = serviceContainer.get(types_4.ITestsHelper);
    }
    get onDidChange() {
        return this.didChange.event;
    }
    dispose() {
        this.clearProgressTicker();
        this.statusBar.dispose();
    }
    get enabled() {
        return this._enabled;
    }
    set enabled(enable) {
        this._enabled = enable;
        if (enable) {
            this.statusBar.show();
        }
        else {
            this.statusBar.hide();
        }
    }
    displayProgressStatus(testRunResult, debug = false) {
        this.displayProgress('Running Tests', 'Running Tests (Click to Stop)', constants.Commands.Tests_Ask_To_Stop_Test);
        testRunResult
            .then(tests => this.updateTestRunWithSuccess(tests, debug))
            .catch(this.updateTestRunWithFailure.bind(this))
            // We don't care about any other exceptions returned by updateTestRunWithFailure
            .catch(misc_1.noop);
    }
    displayDiscoverStatus(testDiscovery, quietMode = false) {
        this.displayProgress('Discovering Tests', 'Discovering tests (click to stop)', constants.Commands.Tests_Ask_To_Stop_Discovery);
        return testDiscovery.then(tests => {
            this.updateWithDiscoverSuccess(tests, quietMode);
            return tests;
        }).catch(reason => {
            this.updateWithDiscoverFailure(reason);
            return Promise.reject(reason);
        });
    }
    updateTestRunWithSuccess(tests, debug = false) {
        this.clearProgressTicker();
        // Treat errors as a special case, as we generally wouldn't have any errors
        const statusText = [];
        const toolTip = [];
        let foreColor = '';
        if (tests.summary.passed > 0) {
            statusText.push(`${constants.Octicons.Test_Pass} ${tests.summary.passed}`);
            toolTip.push(`${tests.summary.passed} Passed`);
            foreColor = '#66ff66';
        }
        if (tests.summary.skipped > 0) {
            statusText.push(`${constants.Octicons.Test_Skip} ${tests.summary.skipped}`);
            toolTip.push(`${tests.summary.skipped} Skipped`);
            foreColor = '#66ff66';
        }
        if (tests.summary.failures > 0) {
            statusText.push(`${constants.Octicons.Test_Fail} ${tests.summary.failures}`);
            toolTip.push(`${tests.summary.failures} Failed`);
            foreColor = 'yellow';
        }
        if (tests.summary.errors > 0) {
            statusText.push(`${constants.Octicons.Test_Error} ${tests.summary.errors}`);
            toolTip.push(`${tests.summary.errors} Error${tests.summary.errors > 1 ? 's' : ''}`);
            foreColor = 'yellow';
        }
        this.statusBar.tooltip = toolTip.length === 0 ? 'No Tests Ran' : `${toolTip.join(', ')} (Tests)`;
        this.statusBar.text = statusText.length === 0 ? 'No Tests Ran' : statusText.join(' ');
        this.statusBar.color = foreColor;
        this.statusBar.command = constants.Commands.Tests_View_UI;
        this.didChange.fire();
        if (statusText.length === 0 && !debug) {
            this.appShell.showWarningMessage('No tests ran, please check the configuration settings for the tests.');
        }
        return tests;
    }
    // tslint:disable-next-line:no-any
    updateTestRunWithFailure(reason) {
        this.clearProgressTicker();
        this.statusBar.command = constants.Commands.Tests_View_UI;
        if (reason === constants_1.CANCELLATION_REASON) {
            this.statusBar.text = '$(zap) Run Tests';
            this.statusBar.tooltip = 'Run Tests';
        }
        else {
            this.statusBar.text = '$(alert) Tests Failed';
            this.statusBar.tooltip = 'Running Tests Failed';
            this.testsHelper.displayTestErrorMessage('There was an error in running the tests.');
        }
        return Promise.reject(reason);
    }
    displayProgress(message, tooltip, command) {
        this.progressPrefix = this.statusBar.text = `$(stop) ${message}`;
        this.statusBar.command = command;
        this.statusBar.tooltip = tooltip;
        this.statusBar.show();
        this.clearProgressTicker();
        this.progressTimeout = setInterval(() => this.updateProgressTicker(), 150);
    }
    updateProgressTicker() {
        const text = `${this.progressPrefix} ${this.ticker[this.discoverCounter % 7]}`;
        this.discoverCounter += 1;
        this.statusBar.text = text;
    }
    clearProgressTicker() {
        if (this.progressTimeout) {
            clearInterval(this.progressTimeout);
        }
        this.progressTimeout = null;
        this.discoverCounter = 0;
    }
    // tslint:disable-next-line:no-any
    disableTests() {
        return __awaiter(this, void 0, void 0, function* () {
            const configurationService = this.serviceContainer.get(types_2.IConfigurationService);
            const settingsToDisable = ['unitTest.promptToConfigure', 'unitTest.pyTestEnabled',
                'unitTest.unittestEnabled', 'unitTest.nosetestsEnabled'];
            for (const setting of settingsToDisable) {
                yield configurationService.updateSetting(setting, false).catch(misc_1.noop);
            }
        });
    }
    updateWithDiscoverSuccess(tests, quietMode = false) {
        this.clearProgressTicker();
        const haveTests = tests && (tests.testFunctions.length > 0);
        this.statusBar.text = '$(zap) Run Tests';
        this.statusBar.tooltip = 'Run Tests';
        this.statusBar.command = constants.Commands.Tests_View_UI;
        this.statusBar.show();
        if (this.didChange) {
            this.didChange.fire();
        }
        if (!haveTests && !quietMode) {
            this.appShell.showInformationMessage('No tests discovered, please check the configuration settings for the tests.', 'Disable Tests').then(item => {
                if (item === 'Disable Tests') {
                    this.disableTests()
                        .catch(ex => console.error('Python Extension: disableTests', ex));
                }
            });
        }
    }
    // tslint:disable-next-line:no-any
    updateWithDiscoverFailure(reason) {
        this.clearProgressTicker();
        this.statusBar.text = '$(zap) Discover Tests';
        this.statusBar.tooltip = 'Discover Tests';
        this.statusBar.command = constants.Commands.Tests_Discover;
        this.statusBar.show();
        this.statusBar.color = 'yellow';
        if (reason !== constants_1.CANCELLATION_REASON) {
            this.statusBar.text = '$(alert) Test discovery failed';
            this.statusBar.tooltip = 'Discovering Tests failed (view \'Python Test Log\' output panel for details)';
            // tslint:disable-next-line:no-suspicious-comment
            // TODO: ignore this quitemode, always display the error message (inform the user).
            if (!helpers_1.isNotInstalledError(reason)) {
                // tslint:disable-next-line:no-suspicious-comment
                // TODO: show an option that will invoke a command 'python.test.configureTest' or similar.
                // This will be hanlded by main.ts that will capture input from user and configure the tests.
                this.appShell.showErrorMessage('Test discovery error, please check the configuration settings for the tests.');
            }
        }
    }
};
TestResultDisplay = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_3.IServiceContainer))
], TestResultDisplay);
exports.TestResultDisplay = TestResultDisplay;
//# sourceMappingURL=main.js.map