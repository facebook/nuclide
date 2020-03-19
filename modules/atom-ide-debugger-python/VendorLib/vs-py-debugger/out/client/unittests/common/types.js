"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var TestStatus;
(function (TestStatus) {
    TestStatus[TestStatus["Unknown"] = 0] = "Unknown";
    TestStatus[TestStatus["Discovering"] = 1] = "Discovering";
    TestStatus[TestStatus["Idle"] = 2] = "Idle";
    TestStatus[TestStatus["Running"] = 3] = "Running";
    TestStatus[TestStatus["Fail"] = 4] = "Fail";
    TestStatus[TestStatus["Error"] = 5] = "Error";
    TestStatus[TestStatus["Skipped"] = 6] = "Skipped";
    TestStatus[TestStatus["Pass"] = 7] = "Pass";
})(TestStatus = exports.TestStatus || (exports.TestStatus = {}));
exports.ITestConfigSettingsService = Symbol('ITestConfigSettingsService');
exports.IWorkspaceTestManagerService = Symbol('IWorkspaceTestManagerService');
exports.ITestsHelper = Symbol('ITestsHelper');
exports.ITestVisitor = Symbol('ITestVisitor');
exports.ITestCollectionStorageService = Symbol('ITestCollectionStorageService');
exports.ITestResultsService = Symbol('ITestResultsService');
exports.ITestDebugLauncher = Symbol('ITestDebugLauncher');
exports.ITestManagerFactory = Symbol('ITestManagerFactory');
exports.ITestManagerServiceFactory = Symbol('TestManagerServiceFactory');
exports.ITestManager = Symbol('ITestManager');
exports.ITestDiscoveryService = Symbol('ITestDiscoveryService');
exports.ITestsParser = Symbol('ITestsParser');
exports.IUnitTestSocketServer = Symbol('IUnitTestSocketServer');
exports.ITestRunner = Symbol('ITestRunner');
var PassCalculationFormulae;
(function (PassCalculationFormulae) {
    PassCalculationFormulae[PassCalculationFormulae["pytest"] = 0] = "pytest";
    PassCalculationFormulae[PassCalculationFormulae["nosetests"] = 1] = "nosetests";
})(PassCalculationFormulae = exports.PassCalculationFormulae || (exports.PassCalculationFormulae = {}));
exports.IXUnitParser = Symbol('IXUnitParser');
//# sourceMappingURL=types.js.map