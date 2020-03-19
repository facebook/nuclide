"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("inversify");
const types_1 = require("../types");
let TestResultResetVisitor = class TestResultResetVisitor {
    visitTestFunction(testFunction) {
        testFunction.passed = undefined;
        testFunction.time = 0;
        testFunction.message = '';
        testFunction.traceback = '';
        testFunction.status = types_1.TestStatus.Unknown;
        testFunction.functionsFailed = 0;
        testFunction.functionsPassed = 0;
        testFunction.functionsDidNotRun = 0;
    }
    visitTestSuite(testSuite) {
        testSuite.passed = undefined;
        testSuite.time = 0;
        testSuite.status = types_1.TestStatus.Unknown;
        testSuite.functionsFailed = 0;
        testSuite.functionsPassed = 0;
        testSuite.functionsDidNotRun = 0;
    }
    visitTestFile(testFile) {
        testFile.passed = undefined;
        testFile.time = 0;
        testFile.status = types_1.TestStatus.Unknown;
        testFile.functionsFailed = 0;
        testFile.functionsPassed = 0;
        testFile.functionsDidNotRun = 0;
    }
    visitTestFolder(testFolder) {
        testFolder.functionsDidNotRun = 0;
        testFolder.functionsFailed = 0;
        testFolder.functionsPassed = 0;
        testFolder.passed = undefined;
        testFolder.status = types_1.TestStatus.Unknown;
    }
};
TestResultResetVisitor = __decorate([
    inversify_1.injectable()
], TestResultResetVisitor);
exports.TestResultResetVisitor = TestResultResetVisitor;
//# sourceMappingURL=resultResetVisitor.js.map