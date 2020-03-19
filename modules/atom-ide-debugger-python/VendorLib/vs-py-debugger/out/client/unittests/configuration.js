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
const types_1 = require("../common/application/types");
const types_2 = require("../common/types");
const types_3 = require("../ioc/types");
const constants_1 = require("./common/constants");
const types_4 = require("./types");
let UnitTestConfigurationService = class UnitTestConfigurationService {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
        this.configurationService = serviceContainer.get(types_2.IConfigurationService);
        this.appShell = serviceContainer.get(types_1.IApplicationShell);
        this.installer = serviceContainer.get(types_2.IInstaller);
        this.outputChannel = serviceContainer.get(types_2.IOutputChannel, constants_1.TEST_OUTPUT_CHANNEL);
        this.workspaceService = serviceContainer.get(types_1.IWorkspaceService);
    }
    displayTestFrameworkError(wkspace) {
        return __awaiter(this, void 0, void 0, function* () {
            const settings = this.configurationService.getSettings(wkspace);
            let enabledCount = settings.unitTest.pyTestEnabled ? 1 : 0;
            enabledCount += settings.unitTest.nosetestsEnabled ? 1 : 0;
            enabledCount += settings.unitTest.unittestEnabled ? 1 : 0;
            if (enabledCount > 1) {
                return this.promptToEnableAndConfigureTestFramework(wkspace, this.installer, this.outputChannel, 'Enable only one of the test frameworks (unittest, pytest or nosetest).', true);
            }
            else {
                const option = 'Enable and configure a Test Framework';
                const item = yield this.appShell.showInformationMessage('No test framework configured (unittest, pytest or nosetest)', option);
                if (item === option) {
                    return this.promptToEnableAndConfigureTestFramework(wkspace, this.installer, this.outputChannel);
                }
                return Promise.reject(null);
            }
        });
    }
    selectTestRunner(placeHolderMessage) {
        return __awaiter(this, void 0, void 0, function* () {
            const items = [{
                    label: 'unittest',
                    product: types_2.Product.unittest,
                    description: 'Standard Python test framework',
                    detail: 'https://docs.python.org/3/library/unittest.html'
                },
                {
                    label: 'pytest',
                    product: types_2.Product.pytest,
                    description: 'Can run unittest (including trial) and nose test suites out of the box',
                    // tslint:disable-next-line:no-http-string
                    detail: 'http://docs.pytest.org/'
                },
                {
                    label: 'nose',
                    product: types_2.Product.nosetest,
                    description: 'nose framework',
                    detail: 'https://nose.readthedocs.io/'
                }];
            const options = {
                matchOnDescription: true,
                matchOnDetail: true,
                placeHolder: placeHolderMessage
            };
            const selectedTestRunner = yield this.appShell.showQuickPick(items, options);
            // tslint:disable-next-line:prefer-type-cast
            return selectedTestRunner ? selectedTestRunner.product : undefined;
        });
    }
    enableTest(wkspace, product) {
        const factory = this.serviceContainer.get(types_4.ITestConfigurationManagerFactory);
        const configMgr = factory.create(wkspace, product);
        const pythonConfig = this.workspaceService.getConfiguration('python', wkspace);
        if (pythonConfig.get('unitTest.promptToConfigure')) {
            return configMgr.enable();
        }
        return pythonConfig.update('unitTest.promptToConfigure', undefined).then(() => {
            return configMgr.enable();
        }, reason => {
            return configMgr.enable().then(() => Promise.reject(reason));
        });
    }
    promptToEnableAndConfigureTestFramework(wkspace, installer, outputChannel, messageToDisplay = 'Select a test framework/tool to enable', enableOnly = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const selectedTestRunner = yield this.selectTestRunner(messageToDisplay);
            if (typeof selectedTestRunner !== 'number') {
                return Promise.reject(null);
            }
            const factory = this.serviceContainer.get(types_4.ITestConfigurationManagerFactory);
            const configMgr = factory.create(wkspace, selectedTestRunner);
            if (enableOnly) {
                // Ensure others are disabled
                [types_2.Product.unittest, types_2.Product.pytest, types_2.Product.nosetest]
                    .filter(prod => selectedTestRunner !== prod)
                    .forEach(prod => {
                    factory.create(wkspace, prod).disable()
                        .catch(ex => console.error('Python Extension: createTestConfigurationManager.disable', ex));
                });
                return configMgr.enable();
            }
            // Configure everything before enabling.
            // Cuz we don't want the test engine (in main.ts file - tests get discovered when config changes are detected)
            // to start discovering tests when tests haven't been configured properly.
            return configMgr.configure(wkspace)
                .then(() => this.enableTest(wkspace, selectedTestRunner))
                .catch(reason => { return this.enableTest(wkspace, selectedTestRunner).then(() => Promise.reject(reason)); });
        });
    }
};
UnitTestConfigurationService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_3.IServiceContainer))
], UnitTestConfigurationService);
exports.UnitTestConfigurationService = UnitTestConfigurationService;
//# sourceMappingURL=configuration.js.map