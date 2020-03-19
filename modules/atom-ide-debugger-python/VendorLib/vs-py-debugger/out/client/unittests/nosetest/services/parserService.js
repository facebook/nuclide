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
const NOSE_WANT_FILE_PREFIX = 'nose.selector: DEBUG: wantFile ';
const NOSE_WANT_FILE_SUFFIX = '.py? True';
const NOSE_WANT_FILE_SUFFIX_WITHOUT_EXT = '? True';
let TestsParser = class TestsParser {
    constructor(testsHelper) {
        this.testsHelper = testsHelper;
    }
    parse(content, options) {
        let testFiles = this.getTestFiles(content, options);
        // Exclude tests that don't have any functions or test suites.
        testFiles = testFiles.filter(testFile => testFile.suites.length > 0 || testFile.functions.length > 0);
        return this.testsHelper.flattenTestFiles(testFiles);
    }
    getTestFiles(content, options) {
        let logOutputLines = [''];
        const testFiles = [];
        content.split(/\r?\n/g).forEach((line, index, lines) => {
            if ((line.startsWith(NOSE_WANT_FILE_PREFIX) && line.endsWith(NOSE_WANT_FILE_SUFFIX)) ||
                index === lines.length - 1) {
                // process the previous lines.
                this.parseNoseTestModuleCollectionResult(options.cwd, logOutputLines, testFiles);
                logOutputLines = [''];
            }
            if (index === 0) {
                if (content.startsWith(os.EOL) || lines.length > 1) {
                    this.appendLine(line, logOutputLines);
                    return;
                }
                logOutputLines[logOutputLines.length - 1] += line;
                return;
            }
            if (index === lines.length - 1) {
                logOutputLines[logOutputLines.length - 1] += line;
                return;
            }
            this.appendLine(line, logOutputLines);
            return;
        });
        return testFiles;
    }
    appendLine(line, logOutputLines) {
        const lastLineIndex = logOutputLines.length - 1;
        logOutputLines[lastLineIndex] += line;
        // Check whether the previous line is something that we need.
        // What we need is a line that ends with ? True,
        //  and starts with nose.selector: DEBUG: want.
        if (logOutputLines[lastLineIndex].endsWith('? True')) {
            logOutputLines.push('');
        }
        else {
            // We don't need this line
            logOutputLines[lastLineIndex] = '';
        }
    }
    parseNoseTestModuleCollectionResult(rootDirectory, lines, testFiles) {
        let currentPackage = '';
        let fileName = '';
        let testFile;
        lines.forEach(line => {
            if (line.startsWith(NOSE_WANT_FILE_PREFIX) && line.endsWith(NOSE_WANT_FILE_SUFFIX)) {
                fileName = line.substring(NOSE_WANT_FILE_PREFIX.length);
                fileName = fileName.substring(0, fileName.lastIndexOf(NOSE_WANT_FILE_SUFFIX_WITHOUT_EXT));
                // We need to display the path relative to the current directory.
                fileName = fileName.substring(rootDirectory.length + 1);
                // we don't care about the compiled file.
                if (path.extname(fileName) === '.pyc' || path.extname(fileName) === '.pyo') {
                    fileName = fileName.substring(0, fileName.length - 1);
                }
                currentPackage = testUtils_1.convertFileToPackage(fileName);
                const fullyQualifiedName = path.isAbsolute(fileName) ? fileName : path.resolve(rootDirectory, fileName);
                testFile = {
                    functions: [], suites: [], name: fileName, nameToRun: fileName,
                    xmlName: currentPackage, time: 0, functionsFailed: 0, functionsPassed: 0,
                    fullPath: fullyQualifiedName
                };
                testFiles.push(testFile);
                return;
            }
            if (line.startsWith('nose.selector: DEBUG: wantClass <class \'')) {
                const name = testUtils_1.extractBetweenDelimiters(line, 'nose.selector: DEBUG: wantClass <class \'', '\'>? True');
                const clsName = path.extname(name).substring(1);
                const testSuite = {
                    name: clsName, nameToRun: `${fileName}:${clsName}`,
                    functions: [], suites: [], xmlName: name, time: 0, isUnitTest: false,
                    isInstance: false, functionsFailed: 0, functionsPassed: 0
                };
                testFile.suites.push(testSuite);
                return;
            }
            if (line.startsWith('nose.selector: DEBUG: wantClass ')) {
                const name = testUtils_1.extractBetweenDelimiters(line, 'nose.selector: DEBUG: wantClass ', '? True');
                const testSuite = {
                    name: path.extname(name).substring(1), nameToRun: `${fileName}:.${name}`,
                    functions: [], suites: [], xmlName: name, time: 0, isUnitTest: false,
                    isInstance: false, functionsFailed: 0, functionsPassed: 0
                };
                testFile.suites.push(testSuite);
                return;
            }
            if (line.startsWith('nose.selector: DEBUG: wantMethod <unbound method ')) {
                const name = testUtils_1.extractBetweenDelimiters(line, 'nose.selector: DEBUG: wantMethod <unbound method ', '>? True');
                const fnName = path.extname(name).substring(1);
                const clsName = path.basename(name, path.extname(name));
                const fn = {
                    name: fnName, nameToRun: `${fileName}:${clsName}.${fnName}`,
                    time: 0, functionsFailed: 0, functionsPassed: 0
                };
                const cls = testFile.suites.find(suite => suite.name === clsName);
                if (cls) {
                    cls.functions.push(fn);
                }
                return;
            }
            if (line.startsWith('nose.selector: DEBUG: wantFunction <function ')) {
                const name = testUtils_1.extractBetweenDelimiters(line, 'nose.selector: DEBUG: wantFunction <function ', ' at ');
                const fn = {
                    name: name, nameToRun: `${fileName}:${name}`,
                    time: 0, functionsFailed: 0, functionsPassed: 0
                };
                testFile.functions.push(fn);
                return;
            }
        });
    }
};
TestsParser = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.ITestsHelper))
], TestsParser);
exports.TestsParser = TestsParser;
//# sourceMappingURL=parserService.js.map