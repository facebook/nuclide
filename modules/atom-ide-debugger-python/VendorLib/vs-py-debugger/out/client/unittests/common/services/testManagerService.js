"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const configSettings_1 = require("../../../common/configSettings");
const types_1 = require("../../../common/types");
const types_2 = require("./../types");
class TestManagerService {
    constructor(wkspace, testsHelper, serviceContainer) {
        this.wkspace = wkspace;
        this.testsHelper = testsHelper;
        this.serviceContainer = serviceContainer;
        this.cachedTestManagers = new Map();
        const disposables = serviceContainer.get(types_1.IDisposableRegistry);
        disposables.push(this);
    }
    dispose() {
        this.cachedTestManagers.forEach(info => {
            info.dispose();
        });
    }
    getTestManager() {
        const preferredTestManager = this.getPreferredTestManager();
        if (typeof preferredTestManager !== 'number') {
            return;
        }
        // tslint:disable-next-line:no-non-null-assertion
        if (!this.cachedTestManagers.has(preferredTestManager)) {
            const testDirectory = this.getTestWorkingDirectory();
            const testProvider = this.testsHelper.parseProviderName(preferredTestManager);
            const factory = this.serviceContainer.get(types_2.ITestManagerFactory);
            this.cachedTestManagers.set(preferredTestManager, factory(testProvider, this.wkspace, testDirectory));
        }
        const testManager = this.cachedTestManagers.get(preferredTestManager);
        return testManager.enabled ? testManager : undefined;
    }
    getTestWorkingDirectory() {
        const settings = configSettings_1.PythonSettings.getInstance(this.wkspace);
        return settings.unitTest.cwd && settings.unitTest.cwd.length > 0 ? settings.unitTest.cwd : this.wkspace.fsPath;
    }
    getPreferredTestManager() {
        const settings = configSettings_1.PythonSettings.getInstance(this.wkspace);
        if (settings.unitTest.nosetestsEnabled) {
            return types_1.Product.nosetest;
        }
        else if (settings.unitTest.pyTestEnabled) {
            return types_1.Product.pytest;
        }
        else if (settings.unitTest.unittestEnabled) {
            return types_1.Product.unittest;
        }
        return undefined;
    }
}
exports.TestManagerService = TestManagerService;
//# sourceMappingURL=testManagerService.js.map