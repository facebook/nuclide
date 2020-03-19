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
const path = require("path");
const vscode_1 = require("vscode");
const types_1 = require("../../common/application/types");
const constants = require("../../common/constants");
const misc_1 = require("../../common/utils/misc");
const types_2 = require("../../ioc/types");
const types_3 = require("../common/types");
let TestDisplay = class TestDisplay {
    constructor(serviceRegistry) {
        this.testCollectionStorage = serviceRegistry.get(types_3.ITestCollectionStorageService);
        this.appShell = serviceRegistry.get(types_1.IApplicationShell);
    }
    displayStopTestUI(workspace, message) {
        this.appShell.showQuickPick([message]).then(item => {
            if (item === message) {
                vscode_1.commands.executeCommand(constants.Commands.Tests_Stop, undefined, workspace);
            }
        });
    }
    displayTestUI(cmdSource, wkspace) {
        const tests = this.testCollectionStorage.getTests(wkspace);
        this.appShell.showQuickPick(buildItems(tests), { matchOnDescription: true, matchOnDetail: true })
            .then(item => item ? onItemSelected(cmdSource, wkspace, item, false) : misc_1.noop());
    }
    selectTestFunction(rootDirectory, tests) {
        return new Promise((resolve, reject) => {
            this.appShell.showQuickPick(buildItemsForFunctions(rootDirectory, tests.testFunctions), { matchOnDescription: true, matchOnDetail: true })
                .then(item => {
                if (item && item.fn) {
                    return resolve(item.fn);
                }
                return reject();
            }, reject);
        });
    }
    selectTestFile(rootDirectory, tests) {
        return new Promise((resolve, reject) => {
            this.appShell.showQuickPick(buildItemsForTestFiles(rootDirectory, tests.testFiles), { matchOnDescription: true, matchOnDetail: true })
                .then(item => {
                if (item && item.testFile) {
                    return resolve(item.testFile);
                }
                return reject();
            }, reject);
        });
    }
    displayFunctionTestPickerUI(cmdSource, wkspace, rootDirectory, file, testFunctions, debug) {
        const tests = this.testCollectionStorage.getTests(wkspace);
        if (!tests) {
            return;
        }
        const fileName = file.fsPath;
        const testFile = tests.testFiles.find(item => item.name === fileName || item.fullPath === fileName);
        if (!testFile) {
            return;
        }
        const flattenedFunctions = tests.testFunctions.filter(fn => {
            return fn.parentTestFile.name === testFile.name &&
                testFunctions.some(testFunc => testFunc.nameToRun === fn.testFunction.nameToRun);
        });
        this.appShell.showQuickPick(buildItemsForFunctions(rootDirectory, flattenedFunctions, undefined, undefined, debug), { matchOnDescription: true, matchOnDetail: true })
            .then(testItem => testItem ? onItemSelected(cmdSource, wkspace, testItem, debug) : misc_1.noop());
    }
};
TestDisplay = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_2.IServiceContainer))
], TestDisplay);
exports.TestDisplay = TestDisplay;
var Type;
(function (Type) {
    Type[Type["RunAll"] = 0] = "RunAll";
    Type[Type["ReDiscover"] = 1] = "ReDiscover";
    Type[Type["RunFailed"] = 2] = "RunFailed";
    Type[Type["RunFolder"] = 3] = "RunFolder";
    Type[Type["RunFile"] = 4] = "RunFile";
    Type[Type["RunClass"] = 5] = "RunClass";
    Type[Type["RunMethod"] = 6] = "RunMethod";
    Type[Type["ViewTestOutput"] = 7] = "ViewTestOutput";
    Type[Type["Null"] = 8] = "Null";
    Type[Type["SelectAndRunMethod"] = 9] = "SelectAndRunMethod";
    Type[Type["DebugMethod"] = 10] = "DebugMethod";
})(Type || (Type = {}));
const statusIconMapping = new Map();
statusIconMapping.set(types_3.TestStatus.Pass, constants.Octicons.Test_Pass);
statusIconMapping.set(types_3.TestStatus.Fail, constants.Octicons.Test_Fail);
statusIconMapping.set(types_3.TestStatus.Error, constants.Octicons.Test_Error);
statusIconMapping.set(types_3.TestStatus.Skipped, constants.Octicons.Test_Skip);
function getSummary(tests) {
    if (!tests || !tests.summary) {
        return '';
    }
    const statusText = [];
    if (tests.summary.passed > 0) {
        statusText.push(`${constants.Octicons.Test_Pass} ${tests.summary.passed} Passed`);
    }
    if (tests.summary.failures > 0) {
        statusText.push(`${constants.Octicons.Test_Fail} ${tests.summary.failures} Failed`);
    }
    if (tests.summary.errors > 0) {
        const plural = tests.summary.errors === 1 ? '' : 's';
        statusText.push(`${constants.Octicons.Test_Error} ${tests.summary.errors} Error${plural}`);
    }
    if (tests.summary.skipped > 0) {
        statusText.push(`${constants.Octicons.Test_Skip} ${tests.summary.skipped} Skipped`);
    }
    return statusText.join(', ').trim();
}
function buildItems(tests) {
    const items = [];
    items.push({ description: '', label: 'Run All Unit Tests', type: Type.RunAll });
    items.push({ description: '', label: 'Discover Unit Tests', type: Type.ReDiscover });
    items.push({ description: '', label: 'Run Unit Test Method ...', type: Type.SelectAndRunMethod });
    const summary = getSummary(tests);
    items.push({ description: '', label: 'View Unit Test Output', type: Type.ViewTestOutput, detail: summary });
    if (tests && tests.summary.failures > 0) {
        items.push({ description: '', label: 'Run Failed Tests', type: Type.RunFailed, detail: `${constants.Octicons.Test_Fail} ${tests.summary.failures} Failed` });
    }
    return items;
}
const statusSortPrefix = {};
statusSortPrefix[types_3.TestStatus.Error] = '1';
statusSortPrefix[types_3.TestStatus.Fail] = '2';
statusSortPrefix[types_3.TestStatus.Skipped] = '3';
statusSortPrefix[types_3.TestStatus.Pass] = '4';
function buildItemsForFunctions(rootDirectory, tests, sortBasedOnResults = false, displayStatusIcons = false, debug = false) {
    const functionItems = [];
    tests.forEach(fn => {
        let icon = '';
        if (displayStatusIcons && fn.testFunction.status && statusIconMapping.has(fn.testFunction.status)) {
            icon = `${statusIconMapping.get(fn.testFunction.status)} `;
        }
        functionItems.push({
            description: '',
            detail: path.relative(rootDirectory, fn.parentTestFile.fullPath),
            label: icon + fn.testFunction.name,
            type: debug === true ? Type.DebugMethod : Type.RunMethod,
            fn: fn
        });
    });
    functionItems.sort((a, b) => {
        let sortAPrefix = '5-';
        let sortBPrefix = '5-';
        if (sortBasedOnResults && a.fn && a.fn.testFunction.status && b.fn && b.fn.testFunction.status) {
            sortAPrefix = statusSortPrefix[a.fn.testFunction.status] ? statusSortPrefix[a.fn.testFunction.status] : sortAPrefix;
            sortBPrefix = statusSortPrefix[b.fn.testFunction.status] ? statusSortPrefix[b.fn.testFunction.status] : sortBPrefix;
        }
        if (sortAPrefix + a.detail + a.label < sortBPrefix + b.detail + b.label) {
            return -1;
        }
        if (sortAPrefix + a.detail + a.label > sortBPrefix + b.detail + b.label) {
            return 1;
        }
        return 0;
    });
    return functionItems;
}
function buildItemsForTestFiles(rootDirectory, testFiles) {
    const fileItems = testFiles.map(testFile => {
        return {
            description: '',
            detail: path.relative(rootDirectory, testFile.fullPath),
            type: Type.RunFile,
            label: path.basename(testFile.fullPath),
            testFile: testFile
        };
    });
    fileItems.sort((a, b) => {
        if (!a.detail && !b.detail) {
            return 0;
        }
        if (!a.detail || a.detail < b.detail) {
            return -1;
        }
        if (!b.detail || a.detail > b.detail) {
            return 1;
        }
        return 0;
    });
    return fileItems;
}
function onItemSelected(cmdSource, wkspace, selection, debug) {
    if (!selection || typeof selection.type !== 'number') {
        return;
    }
    let cmd = '';
    // tslint:disable-next-line:no-any
    const args = [undefined, cmdSource, wkspace];
    switch (selection.type) {
        case Type.Null: {
            return;
        }
        case Type.RunAll: {
            cmd = constants.Commands.Tests_Run;
            break;
        }
        case Type.ReDiscover: {
            cmd = constants.Commands.Tests_Discover;
            break;
        }
        case Type.ViewTestOutput: {
            cmd = constants.Commands.Tests_ViewOutput;
            break;
        }
        case Type.RunFailed: {
            cmd = constants.Commands.Tests_Run_Failed;
            break;
        }
        case Type.SelectAndRunMethod: {
            cmd = debug ? constants.Commands.Tests_Select_And_Debug_Method : constants.Commands.Tests_Select_And_Run_Method;
            break;
        }
        case Type.RunMethod: {
            cmd = constants.Commands.Tests_Run;
            // tslint:disable-next-line:prefer-type-cast no-object-literal-type-assertion
            args.push({ testFunction: [selection.fn.testFunction] });
            break;
        }
        case Type.DebugMethod: {
            cmd = constants.Commands.Tests_Debug;
            // tslint:disable-next-line:prefer-type-cast no-object-literal-type-assertion
            args.push({ testFunction: [selection.fn.testFunction] });
            args.push(true);
            break;
        }
        default: {
            return;
        }
    }
    vscode_1.commands.executeCommand(cmd, ...args);
}
//# sourceMappingURL=picker.js.map