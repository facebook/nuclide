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
const types_1 = require("./../types");
let TestResultsService = class TestResultsService {
    constructor(resultResetVisitor) {
        this.resultResetVisitor = resultResetVisitor;
    }
    resetResults(tests) {
        tests.testFolders.forEach(f => this.resultResetVisitor.visitTestFolder(f));
        tests.testFunctions.forEach(fn => this.resultResetVisitor.visitTestFunction(fn.testFunction));
        tests.testSuites.forEach(suite => this.resultResetVisitor.visitTestSuite(suite.testSuite));
        tests.testFiles.forEach(testFile => this.resultResetVisitor.visitTestFile(testFile));
    }
    updateResults(tests) {
        tests.testFiles.forEach(test => this.updateTestFileResults(test));
        tests.testFolders.forEach(folder => this.updateTestFolderResults(folder));
    }
    updateTestSuiteResults(test) {
        this.updateTestSuiteAndFileResults(test);
    }
    updateTestFileResults(test) {
        this.updateTestSuiteAndFileResults(test);
    }
    updateTestFolderResults(testFolder) {
        let allFilesPassed = true;
        let allFilesRan = true;
        testFolder.testFiles.forEach(fl => {
            if (allFilesPassed && typeof fl.passed === 'boolean') {
                if (!fl.passed) {
                    allFilesPassed = false;
                }
            }
            else {
                allFilesRan = false;
            }
            testFolder.functionsFailed += fl.functionsFailed;
            testFolder.functionsPassed += fl.functionsPassed;
        });
        let allFoldersPassed = true;
        let allFoldersRan = true;
        testFolder.folders.forEach(folder => {
            this.updateTestFolderResults(folder);
            if (allFoldersPassed && typeof folder.passed === 'boolean') {
                if (!folder.passed) {
                    allFoldersPassed = false;
                }
            }
            else {
                allFoldersRan = false;
            }
            testFolder.functionsFailed += folder.functionsFailed;
            testFolder.functionsPassed += folder.functionsPassed;
        });
        if (allFilesRan && allFoldersRan) {
            testFolder.passed = allFilesPassed && allFoldersPassed;
            testFolder.status = testFolder.passed ? types_1.TestStatus.Idle : types_1.TestStatus.Fail;
        }
        else {
            testFolder.passed = undefined;
            testFolder.status = types_1.TestStatus.Unknown;
        }
    }
    updateTestSuiteAndFileResults(test) {
        let totalTime = 0;
        let allFunctionsPassed = true;
        let allFunctionsRan = true;
        test.functions.forEach(fn => {
            totalTime += fn.time;
            if (typeof fn.passed === 'boolean') {
                if (fn.passed) {
                    test.functionsPassed += 1;
                }
                else {
                    test.functionsFailed += 1;
                    allFunctionsPassed = false;
                }
            }
            else {
                allFunctionsRan = false;
            }
        });
        let allSuitesPassed = true;
        let allSuitesRan = true;
        test.suites.forEach(suite => {
            this.updateTestSuiteResults(suite);
            totalTime += suite.time;
            if (allSuitesRan && typeof suite.passed === 'boolean') {
                if (!suite.passed) {
                    allSuitesPassed = false;
                }
            }
            else {
                allSuitesRan = false;
            }
            test.functionsFailed += suite.functionsFailed;
            test.functionsPassed += suite.functionsPassed;
        });
        test.time = totalTime;
        if (allSuitesRan && allFunctionsRan) {
            test.passed = allFunctionsPassed && allSuitesPassed;
            test.status = test.passed ? types_1.TestStatus.Idle : types_1.TestStatus.Error;
        }
        else {
            test.passed = undefined;
            test.status = types_1.TestStatus.Unknown;
        }
    }
};
TestResultsService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.ITestVisitor)), __param(0, inversify_1.named('TestResultResetVisitor'))
], TestResultsService);
exports.TestResultsService = TestResultsService;
//# sourceMappingURL=testResultsService.js.map