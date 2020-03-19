// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.IUnitTestConfigurationService = Symbol('IUnitTestConfigurationService');
exports.ITestResultDisplay = Symbol('ITestResultDisplay');
exports.ITestDisplay = Symbol('ITestDisplay');
exports.IUnitTestManagementService = Symbol('IUnitTestManagementService');
exports.ITestConfigurationManagerFactory = Symbol('ITestConfigurationManagerFactory');
var TestFilter;
(function (TestFilter) {
    TestFilter["removeTests"] = "removeTests";
    TestFilter["discovery"] = "discovery";
    TestFilter["runAll"] = "runAll";
    TestFilter["runSpecific"] = "runSpecific";
    TestFilter["debugAll"] = "debugAll";
    TestFilter["debugSpecific"] = "debugSpecific";
})(TestFilter = exports.TestFilter || (exports.TestFilter = {}));
exports.IArgumentsService = Symbol('IArgumentsService');
exports.IArgumentsHelper = Symbol('IArgumentsHelper');
exports.ITestManagerRunner = Symbol('ITestManagerRunner');
exports.IUnitTestHelper = Symbol('IUnitTestHelper');
//# sourceMappingURL=types.js.map