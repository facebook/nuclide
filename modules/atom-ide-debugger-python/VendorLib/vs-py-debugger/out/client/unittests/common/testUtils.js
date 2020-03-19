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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("inversify");
const path = require("path");
const vscode_1 = require("vscode");
const types_1 = require("../../common/application/types");
const constants = require("../../common/constants");
const types_2 = require("../../common/types");
const types_3 = require("../../ioc/types");
const constants_1 = require("./constants");
const types_4 = require("./types");
function selectTestWorkspace() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!Array.isArray(vscode_1.workspace.workspaceFolders) || vscode_1.workspace.workspaceFolders.length === 0) {
            return undefined;
        }
        else if (vscode_1.workspace.workspaceFolders.length === 1) {
            return vscode_1.workspace.workspaceFolders[0].uri;
        }
        else {
            // tslint:disable-next-line:no-any prefer-type-cast
            const workspaceFolder = yield vscode_1.window.showWorkspaceFolderPick({ placeHolder: 'Select a workspace' });
            return workspaceFolder ? workspaceFolder.uri : undefined;
        }
    });
}
exports.selectTestWorkspace = selectTestWorkspace;
function extractBetweenDelimiters(content, startDelimiter, endDelimiter) {
    content = content.substring(content.indexOf(startDelimiter) + startDelimiter.length);
    return content.substring(0, content.lastIndexOf(endDelimiter));
}
exports.extractBetweenDelimiters = extractBetweenDelimiters;
function convertFileToPackage(filePath) {
    const lastIndex = filePath.lastIndexOf('.');
    return filePath.substring(0, lastIndex).replace(/\//g, '.').replace(/\\/g, '.');
}
exports.convertFileToPackage = convertFileToPackage;
let TestsHelper = class TestsHelper {
    constructor(flatteningVisitor, serviceContainer) {
        this.flatteningVisitor = flatteningVisitor;
        this.appShell = serviceContainer.get(types_1.IApplicationShell);
        this.commandManager = serviceContainer.get(types_1.ICommandManager);
    }
    parseProviderName(product) {
        switch (product) {
            case types_2.Product.nosetest: return 'nosetest';
            case types_2.Product.pytest: return 'pytest';
            case types_2.Product.unittest: return 'unittest';
            default: {
                throw new Error(`Unknown Test Product ${product}`);
            }
        }
    }
    parseProduct(provider) {
        switch (provider) {
            case 'nosetest': return types_2.Product.nosetest;
            case 'pytest': return types_2.Product.pytest;
            case 'unittest': return types_2.Product.unittest;
            default: {
                throw new Error(`Unknown Test Provider ${provider}`);
            }
        }
    }
    getSettingsPropertyNames(product) {
        const id = this.parseProviderName(product);
        switch (id) {
            case 'pytest': {
                return {
                    argsName: 'pyTestArgs',
                    pathName: 'pyTestPath',
                    enabledName: 'pyTestEnabled'
                };
            }
            case 'nosetest': {
                return {
                    argsName: 'nosetestArgs',
                    pathName: 'nosetestPath',
                    enabledName: 'nosetestsEnabled'
                };
            }
            case 'unittest': {
                return {
                    argsName: 'unittestArgs',
                    enabledName: 'unittestEnabled'
                };
            }
            default: {
                throw new Error(`Unknown Test Provider '${product}'`);
            }
        }
    }
    flattenTestFiles(testFiles) {
        testFiles.forEach(testFile => this.flatteningVisitor.visitTestFile(testFile));
        // tslint:disable-next-line:no-object-literal-type-assertion
        const tests = {
            testFiles: testFiles,
            testFunctions: this.flatteningVisitor.flattenedTestFunctions,
            testSuites: this.flatteningVisitor.flattenedTestSuites,
            testFolders: [],
            rootTestFolders: [],
            summary: { passed: 0, failures: 0, errors: 0, skipped: 0 }
        };
        this.placeTestFilesIntoFolders(tests);
        return tests;
    }
    placeTestFilesIntoFolders(tests) {
        // First get all the unique folders
        const folders = [];
        tests.testFiles.forEach(file => {
            const dir = path.dirname(file.name);
            if (folders.indexOf(dir) === -1) {
                folders.push(dir);
            }
        });
        tests.testFolders = [];
        const folderMap = new Map();
        folders.sort();
        folders.forEach(dir => {
            dir.split(path.sep).reduce((parentPath, currentName, index, values) => {
                let newPath = currentName;
                let parentFolder;
                if (parentPath.length > 0) {
                    parentFolder = folderMap.get(parentPath);
                    newPath = path.join(parentPath, currentName);
                }
                if (!folderMap.has(newPath)) {
                    const testFolder = { name: newPath, testFiles: [], folders: [], nameToRun: newPath, time: 0 };
                    folderMap.set(newPath, testFolder);
                    if (parentFolder) {
                        parentFolder.folders.push(testFolder);
                    }
                    else {
                        tests.rootTestFolders.push(testFolder);
                    }
                    tests.testFiles.filter(fl => path.dirname(fl.name) === newPath).forEach(testFile => {
                        testFolder.testFiles.push(testFile);
                    });
                    tests.testFolders.push(testFolder);
                }
                return newPath;
            }, '');
        });
    }
    parseTestName(name, rootDirectory, tests) {
        // tslint:disable-next-line:no-suspicious-comment
        // TODO: We need a better way to match (currently we have raw name, name, xmlname, etc = which one do we.
        // Use to identify a file given the full file name, similarly for a folder and function.
        // Perhaps something like a parser or methods like TestFunction.fromString()... something).
        if (!tests) {
            return undefined;
        }
        const absolutePath = path.isAbsolute(name) ? name : path.resolve(rootDirectory, name);
        const testFolders = tests.testFolders.filter(folder => folder.nameToRun === name || folder.name === name || folder.name === absolutePath);
        if (testFolders.length > 0) {
            return { testFolder: testFolders };
        }
        const testFiles = tests.testFiles.filter(file => file.nameToRun === name || file.name === name || file.fullPath === absolutePath);
        if (testFiles.length > 0) {
            return { testFile: testFiles };
        }
        const testFns = tests.testFunctions.filter(fn => fn.testFunction.nameToRun === name || fn.testFunction.name === name).map(fn => fn.testFunction);
        if (testFns.length > 0) {
            return { testFunction: testFns };
        }
        // Just return this as a test file.
        // tslint:disable-next-line:no-object-literal-type-assertion
        return { testFile: [{ name: name, nameToRun: name, functions: [], suites: [], xmlName: name, fullPath: '', time: 0 }] };
    }
    displayTestErrorMessage(message) {
        this.appShell.showErrorMessage(message, constants.Button_Text_Tests_View_Output).then(action => {
            if (action === constants.Button_Text_Tests_View_Output) {
                this.commandManager.executeCommand(constants.Commands.Tests_ViewOutput, undefined, constants_1.CommandSource.ui);
            }
        });
    }
    mergeTests(items) {
        return items.reduce((tests, otherTests, index) => {
            if (index === 0) {
                return tests;
            }
            tests.summary.errors += otherTests.summary.errors;
            tests.summary.failures += otherTests.summary.failures;
            tests.summary.passed += otherTests.summary.passed;
            tests.summary.skipped += otherTests.summary.skipped;
            tests.rootTestFolders.push(...otherTests.rootTestFolders);
            tests.testFiles.push(...otherTests.testFiles);
            tests.testFolders.push(...otherTests.testFolders);
            tests.testFunctions.push(...otherTests.testFunctions);
            tests.testSuites.push(...otherTests.testSuites);
            return tests;
        }, items[0]);
    }
    shouldRunAllTests(testsToRun) {
        if (!testsToRun) {
            return true;
        }
        if ((Array.isArray(testsToRun.testFile) && testsToRun.testFile.length > 0) ||
            (Array.isArray(testsToRun.testFolder) && testsToRun.testFolder.length > 0) ||
            (Array.isArray(testsToRun.testFunction) && testsToRun.testFunction.length > 0) ||
            (Array.isArray(testsToRun.testSuite) && testsToRun.testSuite.length > 0)) {
            return false;
        }
        return true;
    }
};
TestsHelper = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_4.ITestVisitor)), __param(0, inversify_1.named('TestFlatteningVisitor')),
    __param(1, inversify_1.inject(types_3.IServiceContainer))
], TestsHelper);
exports.TestsHelper = TestsHelper;
//# sourceMappingURL=testUtils.js.map