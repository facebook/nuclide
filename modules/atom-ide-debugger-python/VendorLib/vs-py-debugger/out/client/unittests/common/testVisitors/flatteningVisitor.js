"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("inversify");
const testUtils_1 = require("../testUtils");
let TestFlatteningVisitor = class TestFlatteningVisitor {
    constructor() {
        // tslint:disable-next-line:variable-name
        this._flattedTestFunctions = new Map();
        // tslint:disable-next-line:variable-name
        this._flattenedTestSuites = new Map();
    }
    get flattenedTestFunctions() {
        return [...this._flattedTestFunctions.values()];
    }
    get flattenedTestSuites() {
        return [...this._flattenedTestSuites.values()];
    }
    // tslint:disable-next-line:no-empty
    visitTestFunction(testFunction) { }
    // tslint:disable-next-line:no-empty
    visitTestSuite(testSuite) { }
    visitTestFile(testFile) {
        // sample test_three (file name without extension and all / replaced with ., meaning this is the package)
        const packageName = testUtils_1.convertFileToPackage(testFile.name);
        testFile.functions.forEach(fn => this.addTestFunction(fn, testFile, packageName));
        testFile.suites.forEach(suite => this.visitTestSuiteOfAFile(suite, testFile));
    }
    // tslint:disable-next-line:no-empty
    visitTestFolder(testFile) { }
    visitTestSuiteOfAFile(testSuite, parentTestFile) {
        testSuite.functions.forEach(fn => this.visitTestFunctionOfASuite(fn, testSuite, parentTestFile));
        testSuite.suites.forEach(suite => this.visitTestSuiteOfAFile(suite, parentTestFile));
        this.addTestSuite(testSuite, parentTestFile);
    }
    visitTestFunctionOfASuite(testFunction, parentTestSuite, parentTestFile) {
        const key = `Function:${testFunction.name},Suite:${parentTestSuite.name},SuiteXmlName:${parentTestSuite.xmlName},ParentFile:${parentTestFile.fullPath}`;
        if (this._flattenedTestSuites.has(key)) {
            return;
        }
        const flattenedFunction = { testFunction, xmlClassName: parentTestSuite.xmlName, parentTestFile, parentTestSuite };
        this._flattedTestFunctions.set(key, flattenedFunction);
    }
    addTestSuite(testSuite, parentTestFile) {
        const key = `Suite:${testSuite.name},SuiteXmlName:${testSuite.xmlName},ParentFile:${parentTestFile.fullPath}`;
        if (this._flattenedTestSuites.has(key)) {
            return;
        }
        const flattenedSuite = { parentTestFile, testSuite, xmlClassName: testSuite.xmlName };
        this._flattenedTestSuites.set(key, flattenedSuite);
    }
    addTestFunction(testFunction, parentTestFile, parentTestPackage) {
        const key = `Function:${testFunction.name},ParentFile:${parentTestFile.fullPath}`;
        if (this._flattedTestFunctions.has(key)) {
            return;
        }
        const flattendFunction = { testFunction, xmlClassName: parentTestPackage, parentTestFile };
        this._flattedTestFunctions.set(key, flattendFunction);
    }
};
TestFlatteningVisitor = __decorate([
    inversify_1.injectable()
], TestFlatteningVisitor);
exports.TestFlatteningVisitor = TestFlatteningVisitor;
//# sourceMappingURL=flatteningVisitor.js.map