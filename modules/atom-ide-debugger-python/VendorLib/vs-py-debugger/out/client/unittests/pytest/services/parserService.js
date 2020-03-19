"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
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
const os = require("os");
const path = require("path");
const testUtils_1 = require("../../common/testUtils");
const types_1 = require("../../common/types");
const DELIMITER = '\'';
let TestsParser = class TestsParser {
    constructor(testsHelper) {
        this.testsHelper = testsHelper;
    }
    parse(content, options) {
        const testFiles = this.getTestFiles(content, options);
        return this.testsHelper.flattenTestFiles(testFiles);
    }
    getTestFiles(content, options) {
        let logOutputLines = [''];
        const testFiles = [];
        const parentNodes = [];
        const errorLine = /==*( *)ERRORS( *)=*/;
        const errorFileLine = /__*( *)ERROR collecting (.*)/;
        const lastLineWithErrors = /==*.*/;
        let haveErrors = false;
        let packagePrefix = '';
        content.split(/\r?\n/g).forEach((line, index, lines) => {
            if (options.token && options.token.isCancellationRequested) {
                return;
            }
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('<Package \'')) {
                // Process the previous lines.
                this.parsePyTestModuleCollectionResult(options.cwd, logOutputLines, testFiles, parentNodes, packagePrefix);
                logOutputLines = [''];
                packagePrefix = this.extractPackageName(trimmedLine, options.cwd);
            }
            if (trimmedLine.startsWith('<Module \'') || index === lines.length - 1) {
                // Process the previous lines.
                this.parsePyTestModuleCollectionResult(options.cwd, logOutputLines, testFiles, parentNodes, packagePrefix);
                logOutputLines = [''];
            }
            if (errorLine.test(line)) {
                haveErrors = true;
                logOutputLines = [''];
                return;
            }
            if (errorFileLine.test(line)) {
                haveErrors = true;
                if (logOutputLines.length !== 1 && logOutputLines[0].length !== 0) {
                    this.parsePyTestModuleCollectionError(options.cwd, logOutputLines, testFiles, parentNodes);
                    logOutputLines = [''];
                }
            }
            if (lastLineWithErrors.test(line) && haveErrors) {
                this.parsePyTestModuleCollectionError(options.cwd, logOutputLines, testFiles, parentNodes);
                logOutputLines = [''];
            }
            if (index === 0) {
                if (content.startsWith(os.EOL) || lines.length > 1) {
                    logOutputLines[logOutputLines.length - 1] += line;
                    logOutputLines.push('');
                    return;
                }
                logOutputLines[logOutputLines.length - 1] += line;
                return;
            }
            if (index === lines.length - 1) {
                logOutputLines[logOutputLines.length - 1] += line;
                return;
            }
            logOutputLines[logOutputLines.length - 1] += line;
            logOutputLines.push('');
            return;
        });
        return testFiles;
    }
    parsePyTestModuleCollectionError(rootDirectory, lines, testFiles, parentNodes) {
        lines = lines.filter(line => line.trim().length > 0);
        if (lines.length <= 1) {
            return;
        }
        const errorFileLine = lines[0];
        let fileName = errorFileLine.substring(errorFileLine.indexOf('ERROR collecting') + 'ERROR collecting'.length).trim();
        fileName = fileName.substr(0, fileName.lastIndexOf(' '));
        const currentPackage = testUtils_1.convertFileToPackage(fileName);
        const fullyQualifiedName = path.isAbsolute(fileName) ? fileName : path.resolve(rootDirectory, fileName);
        const testFile = {
            functions: [], suites: [], name: fileName, fullPath: fullyQualifiedName,
            nameToRun: fileName, xmlName: currentPackage, time: 0, errorsWhenDiscovering: lines.join('\n')
        };
        testFiles.push(testFile);
        parentNodes.push({ indent: 0, item: testFile });
        return;
    }
    /**
     * Extract the 'package' name from a given PyTest (>= 3.7) output line.
     *
     * @param packageLine A single line of output from pytest that starts with `<Package` (may have leading white space).
     * @param rootDir Value is pytest's `--rootdir=` parameter.
     */
    extractPackageName(packageLine, rootDir) {
        const packagePath = testUtils_1.extractBetweenDelimiters(packageLine, DELIMITER, DELIMITER);
        let packageName = path.normalize(packagePath);
        const tmpRoot = path.normalize(rootDir);
        if (packageName.indexOf(tmpRoot) === 0) {
            packageName = packageName.substring(tmpRoot.length);
            if (packageName.startsWith(path.sep)) {
                packageName = packageName.substring(1);
            }
            if (packageName.endsWith(path.sep)) {
                packageName = packageName.substring(0, packageName.length - 1);
            }
        }
        packageName = packageName.replace(/\\/g, '/');
        return packageName;
    }
    parsePyTestModuleCollectionResult(rootDirectory, lines, testFiles, parentNodes, packagePrefix = '') {
        let currentPackage = '';
        lines.forEach(line => {
            const trimmedLine = line.trim();
            let name = testUtils_1.extractBetweenDelimiters(trimmedLine, DELIMITER, DELIMITER);
            const indent = line.indexOf('<');
            if (trimmedLine.startsWith('<Module \'')) {
                if (packagePrefix && packagePrefix.length > 0) {
                    name = packagePrefix.concat('/', name);
                }
                currentPackage = testUtils_1.convertFileToPackage(name);
                const fullyQualifiedName = path.isAbsolute(name) ? name : path.resolve(rootDirectory, name);
                const testFile = {
                    functions: [], suites: [], name: name, fullPath: fullyQualifiedName,
                    nameToRun: name, xmlName: currentPackage, time: 0
                };
                testFiles.push(testFile);
                parentNodes.push({ indent: indent, item: testFile });
                return;
            }
            const parentNode = this.findParentOfCurrentItem(indent, parentNodes);
            if (parentNode && trimmedLine.startsWith('<Class \'') || trimmedLine.startsWith('<UnitTestCase \'')) {
                const isUnitTest = trimmedLine.startsWith('<UnitTestCase \'');
                const rawName = `${parentNode.item.nameToRun}::${name}`;
                const xmlName = `${parentNode.item.xmlName}.${name}`;
                const testSuite = { name: name, nameToRun: rawName, functions: [], suites: [], isUnitTest: isUnitTest, isInstance: false, xmlName: xmlName, time: 0 };
                parentNode.item.suites.push(testSuite);
                parentNodes.push({ indent: indent, item: testSuite });
                return;
            }
            if (parentNode && trimmedLine.startsWith('<Instance \'')) {
                // tslint:disable-next-line:prefer-type-cast
                const suite = parentNode.item;
                // suite.rawName = suite.rawName + '::()';
                // suite.xmlName = suite.xmlName + '.()';
                suite.isInstance = true;
                return;
            }
            if (parentNode && trimmedLine.startsWith('<TestCaseFunction \'') || trimmedLine.startsWith('<Function \'')) {
                const rawName = `${parentNode.item.nameToRun}::${name}`;
                const fn = { name: name, nameToRun: rawName, time: 0 };
                parentNode.item.functions.push(fn);
                return;
            }
        });
    }
    findParentOfCurrentItem(indentOfCurrentItem, parentNodes) {
        while (parentNodes.length > 0) {
            const parentNode = parentNodes[parentNodes.length - 1];
            if (parentNode.indent < indentOfCurrentItem) {
                return parentNode;
            }
            parentNodes.pop();
            continue;
        }
        return;
    }
};
TestsParser = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.ITestsHelper))
], TestsParser);
exports.TestsParser = TestsParser;
/* Sample output from pytest --collect-only
<Module 'test_another.py'>
  <Class 'Test_CheckMyApp'>
    <Instance '()'>
      <Function 'test_simple_check'>
      <Function 'test_complex_check'>
<Module 'test_one.py'>
  <UnitTestCase 'Test_test1'>
    <TestCaseFunction 'test_A'>
    <TestCaseFunction 'test_B'>
<Module 'test_two.py'>
  <UnitTestCase 'Test_test1'>
    <TestCaseFunction 'test_A2'>
    <TestCaseFunction 'test_B2'>
<Module 'testPasswords/test_Pwd.py'>
  <UnitTestCase 'Test_Pwd'>
    <TestCaseFunction 'test_APwd'>
    <TestCaseFunction 'test_BPwd'>
<Module 'testPasswords/test_multi.py'>
  <Class 'Test_CheckMyApp'>
    <Instance '()'>
      <Function 'test_simple_check'>
      <Function 'test_complex_check'>
      <Class 'Test_NestedClassA'>
        <Instance '()'>
          <Function 'test_nested_class_methodB'>
          <Class 'Test_nested_classB_Of_A'>
            <Instance '()'>
              <Function 'test_d'>
  <Function 'test_username'>
  <Function 'test_parametrized_username[one]'>
  <Function 'test_parametrized_username[two]'>
  <Function 'test_parametrized_username[three]'>
*/
//# sourceMappingURL=parserService.js.map