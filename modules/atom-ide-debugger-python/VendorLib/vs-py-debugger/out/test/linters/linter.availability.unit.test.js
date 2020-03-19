// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const TypeMoq = require("typemoq");
const types_1 = require("../../client/common/types");
const linterAvailability_1 = require("../../client/linters/linterAvailability");
const linterInfo_1 = require("../../client/linters/linterInfo");
// tslint:disable-next-line:max-func-body-length
suite('Linter Availability Provider tests', () => {
    test('Availability feature is disabled when global default for jediEnabled=true.', () => __awaiter(this, void 0, void 0, function* () {
        // set expectations
        const jediEnabledValue = true;
        const expectedResult = false;
        // arrange
        const [appShellMock, installerMock, workspaceServiceMock, configServiceMock] = getDependenciesForAvailabilityTests();
        setupConfigurationServiceForJediSettingsTest(jediEnabledValue, configServiceMock);
        // call
        const availabilityProvider = new linterAvailability_1.AvailableLinterActivator(appShellMock.object, installerMock.object, workspaceServiceMock.object, configServiceMock.object);
        // check expectaions
        chai_1.expect(availabilityProvider.isFeatureEnabled).is.equal(expectedResult, 'Avaialability feature should be disabled when python.jediEnabled is true');
        workspaceServiceMock.verifyAll();
    }));
    test('Availability feature is enabled when global default for jediEnabled=false.', () => __awaiter(this, void 0, void 0, function* () {
        // set expectations
        const jediEnabledValue = false;
        const expectedResult = true;
        // arrange
        const [appShellMock, installerMock, workspaceServiceMock, configServiceMock] = getDependenciesForAvailabilityTests();
        setupConfigurationServiceForJediSettingsTest(jediEnabledValue, configServiceMock);
        const availabilityProvider = new linterAvailability_1.AvailableLinterActivator(appShellMock.object, installerMock.object, workspaceServiceMock.object, configServiceMock.object);
        chai_1.expect(availabilityProvider.isFeatureEnabled).is.equal(expectedResult, 'Avaialability feature should be enabled when python.jediEnabled defaults to false');
        workspaceServiceMock.verifyAll();
    }));
    test('Prompt will be performed when linter is not configured at all for the workspace, workspace-folder, or the user', () => __awaiter(this, void 0, void 0, function* () {
        // setup expectations
        const pylintUserValue = undefined;
        const pylintWorkspaceValue = undefined;
        const pylintWorkspaceFolderValue = undefined;
        const expectedResult = true;
        const [appShellMock, installerMock, workspaceServiceMock, configServiceMock, linterInfo] = getDependenciesForAvailabilityTests();
        setupWorkspaceMockForLinterConfiguredTests(pylintUserValue, pylintWorkspaceValue, pylintWorkspaceFolderValue, workspaceServiceMock);
        const availabilityProvider = new linterAvailability_1.AvailableLinterActivator(appShellMock.object, installerMock.object, workspaceServiceMock.object, configServiceMock.object);
        const result = availabilityProvider.isLinterUsingDefaultConfiguration(linterInfo);
        chai_1.expect(result).to.equal(expectedResult, 'Linter is unconfigured but prompt did not get raised');
        workspaceServiceMock.verifyAll();
    }));
    test('No prompt performed when linter is configured as enabled for the workspace', () => __awaiter(this, void 0, void 0, function* () {
        // setup expectations
        const pylintUserValue = undefined;
        const pylintWorkspaceValue = true;
        const pylintWorkspaceFolderValue = undefined;
        const expectedResult = false;
        const [appShellMock, installerMock, workspaceServiceMock, configServiceMock, linterInfo] = getDependenciesForAvailabilityTests();
        setupWorkspaceMockForLinterConfiguredTests(pylintUserValue, pylintWorkspaceValue, pylintWorkspaceFolderValue, workspaceServiceMock);
        const availabilityProvider = new linterAvailability_1.AvailableLinterActivator(appShellMock.object, installerMock.object, workspaceServiceMock.object, configServiceMock.object);
        const result = availabilityProvider.isLinterUsingDefaultConfiguration(linterInfo);
        chai_1.expect(result).to.equal(expectedResult, 'Available linter prompt should not be shown when linter is configured for workspace.');
        workspaceServiceMock.verifyAll();
    }));
    test('No prompt performed when linter is configured as enabled for the entire user', () => __awaiter(this, void 0, void 0, function* () {
        // setup expectations
        const pylintUserValue = true;
        const pylintWorkspaceValue = undefined;
        const pylintWorkspaceFolderValue = undefined;
        const expectedResult = false;
        // arrange
        const [appShellMock, installerMock, workspaceServiceMock, configServiceMock, linterInfo] = getDependenciesForAvailabilityTests();
        setupWorkspaceMockForLinterConfiguredTests(pylintUserValue, pylintWorkspaceValue, pylintWorkspaceFolderValue, workspaceServiceMock);
        const availabilityProvider = new linterAvailability_1.AvailableLinterActivator(appShellMock.object, installerMock.object, workspaceServiceMock.object, configServiceMock.object);
        const result = availabilityProvider.isLinterUsingDefaultConfiguration(linterInfo);
        chai_1.expect(result).to.equal(expectedResult, 'Available linter prompt should not be shown when linter is configured for user.');
        workspaceServiceMock.verifyAll();
    }));
    test('No prompt performed when linter is configured as enabled for the workspace-folder', () => __awaiter(this, void 0, void 0, function* () {
        // setup expectations
        const pylintUserValue = undefined;
        const pylintWorkspaceValue = undefined;
        const pylintWorkspaceFolderValue = true;
        const expectedResult = false;
        // arrange
        const [appShellMock, installerMock, workspaceServiceMock, configServiceMock, linterInfo] = getDependenciesForAvailabilityTests();
        setupWorkspaceMockForLinterConfiguredTests(pylintUserValue, pylintWorkspaceValue, pylintWorkspaceFolderValue, workspaceServiceMock);
        const availabilityProvider = new linterAvailability_1.AvailableLinterActivator(appShellMock.object, installerMock.object, workspaceServiceMock.object, configServiceMock.object);
        const result = availabilityProvider.isLinterUsingDefaultConfiguration(linterInfo);
        chai_1.expect(result).to.equal(expectedResult, 'Available linter prompt should not be shown when linter is configured for workspace-folder.');
        workspaceServiceMock.verifyAll();
    }));
    function testForLinterPromptResponse(promptReply) {
        return __awaiter(this, void 0, void 0, function* () {
            // arrange
            const [appShellMock, installerMock, workspaceServiceMock] = getDependenciesForAvailabilityTests();
            const configServiceMock = TypeMoq.Mock.ofType();
            const linterInfo = new class extends linterInfo_1.LinterInfo {
                constructor() {
                    super(...arguments);
                    this.testIsEnabled = promptReply ? promptReply.enabled : false;
                }
                enableAsync(enabled, resource) {
                    return __awaiter(this, void 0, void 0, function* () {
                        this.testIsEnabled = enabled;
                        return Promise.resolve();
                    });
                }
            }(types_1.Product.pylint, 'pylint', configServiceMock.object, ['.pylintrc', 'pylintrc']);
            appShellMock.setup(ap => ap.showInformationMessage(TypeMoq.It.isValue(`Linter ${linterInfo.id} is available but not enabled.`), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .returns(() => {
                // tslint:disable-next-line:no-any
                return promptReply;
            })
                .verifiable(TypeMoq.Times.once());
            // perform test
            const availabilityProvider = new linterAvailability_1.AvailableLinterActivator(appShellMock.object, installerMock.object, workspaceServiceMock.object, configServiceMock.object);
            const result = yield availabilityProvider.promptToConfigureAvailableLinter(linterInfo);
            if (promptReply) {
                chai_1.expect(linterInfo.testIsEnabled).to.equal(promptReply.enabled, 'LinterInfo test class was not updated as a result of the test.');
            }
            return result;
        });
    }
    test('Linter is enabled after being prompted and "Enable <linter>" is selected', () => __awaiter(this, void 0, void 0, function* () {
        // set expectations
        const expectedResult = true;
        const promptReply = { title: 'Enable pylint', enabled: true };
        // run scenario
        const result = yield testForLinterPromptResponse(promptReply);
        // test results
        chai_1.expect(result).to.equal(expectedResult, 'Expected promptToConfigureAvailableLinter to return true because the configuration was updated.');
    }));
    test('Linter is disabled after being prompted and "Disable <linter>" is selected', () => __awaiter(this, void 0, void 0, function* () {
        // set expectation
        const promptReply = { title: 'Disable pylint', enabled: false };
        const expectedResult = true;
        // run scenario
        const result = yield testForLinterPromptResponse(promptReply);
        // test results
        chai_1.expect(result).to.equal(expectedResult, 'Expected promptToConfigureAvailableLinter to return true because the configuration was updated.');
    }));
    test('Linter is left unconfigured after being prompted and the prompt is disabled without any selection made', () => __awaiter(this, void 0, void 0, function* () {
        // set expectation
        const promptReply = undefined;
        const expectedResult = false;
        // run scenario
        const result = yield testForLinterPromptResponse(promptReply);
        // test results
        chai_1.expect(result).to.equal(expectedResult, 'Expected promptToConfigureAvailableLinter to return true because the configuration was updated.');
    }));
    // Options to test the implementation of the IAvailableLinterActivator.
    // All options default to values that would otherwise allow the prompt to appear.
    class AvailablityTestOverallOptions {
        constructor() {
            this.jediEnabledValue = false;
            this.linterIsInstalled = true;
        }
    }
    function performTestOfOverallImplementation(options) {
        return __awaiter(this, void 0, void 0, function* () {
            // arrange
            const [appShellMock, installerMock, workspaceServiceMock, configServiceMock, linterInfo] = getDependenciesForAvailabilityTests();
            appShellMock.setup(ap => ap.showInformationMessage(TypeMoq.It.isValue(`Linter ${linterInfo.id} is available but not enabled.`), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                // tslint:disable-next-line:no-any
                .returns(() => options.promptReply)
                .verifiable(TypeMoq.Times.once());
            installerMock.setup(im => im.isInstalled(linterInfo.product, TypeMoq.It.isAny()))
                .returns(() => __awaiter(this, void 0, void 0, function* () { return options.linterIsInstalled; }))
                .verifiable(TypeMoq.Times.once());
            setupConfigurationServiceForJediSettingsTest(options.jediEnabledValue, configServiceMock);
            setupWorkspaceMockForLinterConfiguredTests(options.pylintUserEnabled, options.pylintWorkspaceEnabled, options.pylintWorkspaceFolderEnabled, workspaceServiceMock);
            // perform test
            const availabilityProvider = new linterAvailability_1.AvailableLinterActivator(appShellMock.object, installerMock.object, workspaceServiceMock.object, configServiceMock.object);
            return availabilityProvider.promptIfLinterAvailable(linterInfo);
        });
    }
    test('Overall implementation does not change configuration when feature disabled', () => __awaiter(this, void 0, void 0, function* () {
        // set expectations
        const testOpts = new AvailablityTestOverallOptions();
        testOpts.jediEnabledValue = true;
        const expectedResult = false;
        // arrange
        const result = yield performTestOfOverallImplementation(testOpts);
        // perform test
        chai_1.expect(expectedResult).to.equal(result, 'promptIfLinterAvailable should not change any configuration when python.jediEnabled is true.');
    }));
    test('Overall implementation does not change configuration when linter is configured (enabled)', () => __awaiter(this, void 0, void 0, function* () {
        // set expectations
        const testOpts = new AvailablityTestOverallOptions();
        testOpts.pylintWorkspaceEnabled = true;
        const expectedResult = false;
        // arrange
        const result = yield performTestOfOverallImplementation(testOpts);
        // perform test
        chai_1.expect(expectedResult).to.equal(result, 'Configuration should not change if the linter is configured in any way.');
    }));
    test('Overall implementation does not change configuration when linter is configured (disabled)', () => __awaiter(this, void 0, void 0, function* () {
        // set expectations
        const testOpts = new AvailablityTestOverallOptions();
        testOpts.pylintWorkspaceEnabled = false;
        const expectedResult = false;
        // arrange
        const result = yield performTestOfOverallImplementation(testOpts);
        chai_1.expect(expectedResult).to.equal(result, 'Configuration should not change if the linter is disabled in any way.');
    }));
    test('Overall implementation does not change configuration when linter is unavailable in current workspace environment', () => __awaiter(this, void 0, void 0, function* () {
        // set expectations
        const testOpts = new AvailablityTestOverallOptions();
        testOpts.pylintWorkspaceEnabled = true;
        const expectedResult = false;
        // arrange
        const result = yield performTestOfOverallImplementation(testOpts);
        chai_1.expect(expectedResult).to.equal(result, 'Configuration should not change if the linter is unavailable in the current workspace environment.');
    }));
    test('Overall implementation does not change configuration when user is prompted and prompt is dismissed', () => __awaiter(this, void 0, void 0, function* () {
        // set expectations
        const testOpts = new AvailablityTestOverallOptions();
        testOpts.promptReply = undefined; // just being explicit for test readability - this is the default
        const expectedResult = false;
        // arrange
        const result = yield performTestOfOverallImplementation(testOpts);
        chai_1.expect(expectedResult).to.equal(result, 'Configuration should not change if the user is prompted and they dismiss the prompt.');
    }));
    test('Overall implementation changes configuration when user is prompted and "Disable <linter>" is selected', () => __awaiter(this, void 0, void 0, function* () {
        // set expectations
        const testOpts = new AvailablityTestOverallOptions();
        testOpts.promptReply = { title: 'Disable pylint', enabled: false };
        const expectedResult = true;
        // arrange
        const result = yield performTestOfOverallImplementation(testOpts);
        chai_1.expect(expectedResult).to.equal(result, 'Configuration should change if the user is prompted and they choose to update the linter config.');
    }));
    test('Overall implementation changes configuration when user is prompted and "Enable <linter>" is selected', () => __awaiter(this, void 0, void 0, function* () {
        // set expectations
        const testOpts = new AvailablityTestOverallOptions();
        testOpts.promptReply = { title: 'Enable pylint', enabled: true };
        const expectedResult = true;
        // arrange
        const result = yield performTestOfOverallImplementation(testOpts);
        chai_1.expect(expectedResult).to.equal(result, 'Configuration should change if the user is prompted and they choose to update the linter config.');
    }));
    test('Discovery of linter is available in the environment returns true when it succeeds and is present', () => __awaiter(this, void 0, void 0, function* () {
        // set expectations
        const linterIsInstalled = true;
        const expectedResult = true;
        // arrange
        const [appShellMock, installerMock, workspaceServiceMock, configServiceMock, linterInfo] = getDependenciesForAvailabilityTests();
        setupInstallerForAvailabilityTest(linterInfo, linterIsInstalled, installerMock);
        // perform test
        const availabilityProvider = new linterAvailability_1.AvailableLinterActivator(appShellMock.object, installerMock.object, workspaceServiceMock.object, configServiceMock.object);
        const result = yield availabilityProvider.isLinterAvailable(linterInfo.product);
        chai_1.expect(result).to.equal(expectedResult, 'Expected promptToConfigureAvailableLinter to return true because the configuration was updated.');
        installerMock.verifyAll();
    }));
    test('Discovery of linter is available in the environment returns false when it succeeds and is not present', () => __awaiter(this, void 0, void 0, function* () {
        // set expectations
        const linterIsInstalled = false;
        const expectedResult = false;
        // arrange
        const [appShellMock, installerMock, workspaceServiceMock, configServiceMock, linterInfo] = getDependenciesForAvailabilityTests();
        setupInstallerForAvailabilityTest(linterInfo, linterIsInstalled, installerMock);
        // perform test
        const availabilityProvider = new linterAvailability_1.AvailableLinterActivator(appShellMock.object, installerMock.object, workspaceServiceMock.object, configServiceMock.object);
        const result = yield availabilityProvider.isLinterAvailable(linterInfo.product);
        chai_1.expect(result).to.equal(expectedResult, 'Expected promptToConfigureAvailableLinter to return true because the configuration was updated.');
        installerMock.verifyAll();
    }));
    test('Discovery of linter is available in the environment returns false when it fails', () => __awaiter(this, void 0, void 0, function* () {
        // set expectations
        const expectedResult = false;
        // arrange
        const [appShellMock, installerMock, workspaceServiceMock, configServiceMock, linterInfo] = getDependenciesForAvailabilityTests();
        installerMock.setup(im => im.isInstalled(linterInfo.product, TypeMoq.It.isAny()))
            .returns(() => Promise.reject('error testfail'))
            .verifiable(TypeMoq.Times.once());
        // perform test
        const availabilityProvider = new linterAvailability_1.AvailableLinterActivator(appShellMock.object, installerMock.object, workspaceServiceMock.object, configServiceMock.object);
        const result = yield availabilityProvider.isLinterAvailable(linterInfo.product);
        chai_1.expect(result).to.equal(expectedResult, 'Expected promptToConfigureAvailableLinter to return true because the configuration was updated.');
        installerMock.verifyAll();
    }));
});
function setupWorkspaceMockForLinterConfiguredTests(enabledForUser, enabeldForWorkspace, enabledForWorkspaceFolder, workspaceServiceMock) {
    if (!workspaceServiceMock) {
        workspaceServiceMock = TypeMoq.Mock.ofType();
    }
    const workspaceConfiguration = TypeMoq.Mock.ofType();
    workspaceConfiguration.setup(wc => wc.inspect(TypeMoq.It.isValue('pylintEnabled')))
        .returns(() => {
        return {
            key: '',
            globalValue: enabledForUser,
            defaultValue: false,
            workspaceFolderValue: enabeldForWorkspace,
            workspaceValue: enabledForWorkspaceFolder
        };
    })
        .verifiable(TypeMoq.Times.once());
    workspaceServiceMock.setup(ws => ws.getConfiguration(TypeMoq.It.isValue('python.linting'), TypeMoq.It.isAny()))
        .returns(() => workspaceConfiguration.object)
        .verifiable(TypeMoq.Times.once());
    return workspaceServiceMock;
}
function setupConfigurationServiceForJediSettingsTest(jediEnabledValue, configServiceMock) {
    if (!configServiceMock) {
        configServiceMock = TypeMoq.Mock.ofType();
    }
    const pythonSettings = TypeMoq.Mock.ofType();
    pythonSettings.setup(ps => ps.jediEnabled).returns(() => jediEnabledValue);
    configServiceMock.setup(cs => cs.getSettings()).returns(() => pythonSettings.object);
    return [configServiceMock, pythonSettings];
}
function setupInstallerForAvailabilityTest(linterInfo, linterIsInstalled, installerMock) {
    if (!installerMock) {
        installerMock = TypeMoq.Mock.ofType();
    }
    installerMock.setup(im => im.isInstalled(linterInfo.product, TypeMoq.It.isAny()))
        .returns(() => __awaiter(this, void 0, void 0, function* () { return linterIsInstalled; }))
        .verifiable(TypeMoq.Times.once());
    return installerMock;
}
function getDependenciesForAvailabilityTests() {
    const configServiceMock = TypeMoq.Mock.ofType();
    return [
        TypeMoq.Mock.ofType(),
        TypeMoq.Mock.ofType(),
        TypeMoq.Mock.ofType(),
        TypeMoq.Mock.ofType(),
        new linterInfo_1.LinterInfo(types_1.Product.pylint, 'pylint', configServiceMock.object, ['.pylintrc', 'pylintrc'])
    ];
}
//# sourceMappingURL=linter.availability.unit.test.js.map