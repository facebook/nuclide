"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const inversify_1 = require("inversify");
const xml2js = require("xml2js");
const types_1 = require("./types");
// tslint:disable-next-line:no-any
function getSafeInt(value, defaultValue = 0) {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
        return defaultValue;
    }
    return num;
}
let XUnitParser = class XUnitParser {
    updateResultsFromXmlLogFile(tests, outputXmlFile, passCalculationFormulae) {
        return updateResultsFromXmlLogFile(tests, outputXmlFile, passCalculationFormulae);
    }
};
XUnitParser = __decorate([
    inversify_1.injectable()
], XUnitParser);
exports.XUnitParser = XUnitParser;
function updateResultsFromXmlLogFile(tests, outputXmlFile, passCalculationFormulae) {
    // tslint:disable-next-line:no-any
    return new Promise((resolve, reject) => {
        fs.readFile(outputXmlFile, 'utf8', (err, data) => {
            if (err) {
                return reject(err);
            }
            xml2js.parseString(data, (error, parserResult) => {
                if (error) {
                    return reject(error);
                }
                const testSuiteResult = parserResult.testsuite;
                tests.summary.errors = getSafeInt(testSuiteResult.$.errors);
                tests.summary.failures = getSafeInt(testSuiteResult.$.failures);
                tests.summary.skipped = getSafeInt(testSuiteResult.$.skips ? testSuiteResult.$.skips : testSuiteResult.$.skip);
                const testCount = getSafeInt(testSuiteResult.$.tests);
                switch (passCalculationFormulae) {
                    case types_1.PassCalculationFormulae.pytest: {
                        tests.summary.passed = testCount - tests.summary.failures - tests.summary.skipped - tests.summary.errors;
                        break;
                    }
                    case types_1.PassCalculationFormulae.nosetests: {
                        tests.summary.passed = testCount - tests.summary.failures - tests.summary.skipped - tests.summary.errors;
                        break;
                    }
                    default: {
                        throw new Error('Unknown Test Pass Calculation');
                    }
                }
                if (!Array.isArray(testSuiteResult.testcase)) {
                    return resolve();
                }
                testSuiteResult.testcase.forEach((testcase) => {
                    const xmlClassName = testcase.$.classname.replace(/\(\)/g, '').replace(/\.\./g, '.').replace(/\.\./g, '.').replace(/\.+$/, '');
                    const result = tests.testFunctions.find(fn => fn.xmlClassName === xmlClassName && fn.testFunction.name === testcase.$.name);
                    if (!result) {
                        // Possible we're dealing with nosetests, where the file name isn't returned to us
                        // When dealing with nose tests
                        // It is possible to have a test file named x in two separate test sub directories and have same functions/classes
                        // And unforutnately xunit log doesn't ouput the filename
                        // result = tests.testFunctions.find(fn => fn.testFunction.name === testcase.$.name &&
                        //     fn.parentTestSuite && fn.parentTestSuite.name === testcase.$.classname);
                        // Look for failed file test
                        const fileTest = testcase.$.file && tests.testFiles.find(file => file.nameToRun === testcase.$.file);
                        if (fileTest && testcase.error) {
                            fileTest.status = types_1.TestStatus.Error;
                            fileTest.passed = false;
                            fileTest.message = testcase.error[0].$.message;
                            fileTest.traceback = testcase.error[0]._;
                        }
                        return;
                    }
                    result.testFunction.line = getSafeInt(testcase.$.line, null);
                    result.testFunction.time = parseFloat(testcase.$.time);
                    result.testFunction.passed = true;
                    result.testFunction.status = types_1.TestStatus.Pass;
                    if (testcase.failure) {
                        result.testFunction.status = types_1.TestStatus.Fail;
                        result.testFunction.passed = false;
                        result.testFunction.message = testcase.failure[0].$.message;
                        result.testFunction.traceback = testcase.failure[0]._;
                    }
                    if (testcase.error) {
                        result.testFunction.status = types_1.TestStatus.Error;
                        result.testFunction.passed = false;
                        result.testFunction.message = testcase.error[0].$.message;
                        result.testFunction.traceback = testcase.error[0]._;
                    }
                    if (testcase.skipped) {
                        result.testFunction.status = types_1.TestStatus.Skipped;
                        result.testFunction.passed = undefined;
                        result.testFunction.message = testcase.skipped[0].$.message;
                        result.testFunction.traceback = '';
                    }
                });
                resolve();
            });
        });
    });
}
exports.updateResultsFromXmlLogFile = updateResultsFromXmlLogFile;
//# sourceMappingURL=xUnitParser.js.map