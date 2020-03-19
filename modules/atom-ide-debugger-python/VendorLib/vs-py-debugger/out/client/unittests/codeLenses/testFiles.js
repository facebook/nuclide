'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:no-object-literal-type-assertion
const vscode_1 = require("vscode");
const constants = require("../../common/constants");
const constants_1 = require("../common/constants");
const types_1 = require("../common/types");
class TestFileCodeLensProvider {
    // tslint:disable-next-line:variable-name
    constructor(_onDidChange, symbolProvider, testCollectionStorage) {
        this._onDidChange = _onDidChange;
        this.symbolProvider = symbolProvider;
        this.testCollectionStorage = testCollectionStorage;
    }
    get onDidChangeCodeLenses() {
        return this._onDidChange.event;
    }
    provideCodeLenses(document, token) {
        return __awaiter(this, void 0, void 0, function* () {
            const wkspace = vscode_1.workspace.getWorkspaceFolder(document.uri);
            if (!wkspace) {
                return [];
            }
            const testItems = this.testCollectionStorage.getTests(wkspace.uri);
            if (!testItems || testItems.testFiles.length === 0 || testItems.testFunctions.length === 0) {
                return [];
            }
            const cancelTokenSrc = new vscode_1.CancellationTokenSource();
            token.onCancellationRequested(() => { cancelTokenSrc.cancel(); });
            // Strop trying to build the code lenses if unable to get a list of
            // symbols in this file afrer x time.
            setTimeout(() => {
                if (!cancelTokenSrc.token.isCancellationRequested) {
                    cancelTokenSrc.cancel();
                }
            }, constants.Delays.MaxUnitTestCodeLensDelay);
            return this.getCodeLenses(document, cancelTokenSrc.token, this.symbolProvider);
        });
    }
    resolveCodeLens(codeLens, token) {
        codeLens.command = { command: 'python.runtests', title: 'Test' };
        return Promise.resolve(codeLens);
    }
    getCodeLenses(document, token, symbolProvider) {
        return __awaiter(this, void 0, void 0, function* () {
            const wkspace = vscode_1.workspace.getWorkspaceFolder(document.uri);
            if (!wkspace) {
                return [];
            }
            const tests = this.testCollectionStorage.getTests(wkspace.uri);
            if (!tests) {
                return [];
            }
            const file = tests.testFiles.find(item => item.fullPath === document.uri.fsPath);
            if (!file) {
                return [];
            }
            const allFuncsAndSuites = getAllTestSuitesAndFunctionsPerFile(file);
            try {
                const symbols = (yield symbolProvider.provideDocumentSymbols(document, token));
                if (!symbols) {
                    return [];
                }
                return symbols
                    .filter(symbol => symbol.kind === vscode_1.SymbolKind.Function ||
                    symbol.kind === vscode_1.SymbolKind.Method ||
                    symbol.kind === vscode_1.SymbolKind.Class)
                    .map(symbol => {
                    // This is bloody crucial, if the start and end columns are the same
                    // then vscode goes bonkers when ever you edit a line (start scrolling magically).
                    const range = new vscode_1.Range(symbol.location.range.start, new vscode_1.Position(symbol.location.range.end.line, symbol.location.range.end.character + 1));
                    return this.getCodeLens(document.uri, allFuncsAndSuites, range, symbol.name, symbol.kind, symbol.containerName);
                })
                    .reduce((previous, current) => previous.concat(current), [])
                    .filter(codeLens => codeLens !== null);
            }
            catch (reason) {
                if (token.isCancellationRequested) {
                    return [];
                }
                return Promise.reject(reason);
            }
        });
    }
    getCodeLens(file, allFuncsAndSuites, range, symbolName, symbolKind, symbolContainer) {
        switch (symbolKind) {
            case vscode_1.SymbolKind.Function:
            case vscode_1.SymbolKind.Method: {
                return getFunctionCodeLens(file, allFuncsAndSuites, symbolName, range, symbolContainer);
            }
            case vscode_1.SymbolKind.Class: {
                const cls = allFuncsAndSuites.suites.find(item => item.name === symbolName);
                if (!cls) {
                    return [];
                }
                return [
                    new vscode_1.CodeLens(range, {
                        title: getTestStatusIcon(cls.status) + constants.Text.CodeLensRunUnitTest,
                        command: constants.Commands.Tests_Run,
                        arguments: [undefined, constants_1.CommandSource.codelens, file, { testSuite: [cls] }]
                    }),
                    new vscode_1.CodeLens(range, {
                        title: getTestStatusIcon(cls.status) + constants.Text.CodeLensDebugUnitTest,
                        command: constants.Commands.Tests_Debug,
                        arguments: [undefined, constants_1.CommandSource.codelens, file, { testSuite: [cls] }]
                    })
                ];
            }
            default: {
                return [];
            }
        }
    }
}
exports.TestFileCodeLensProvider = TestFileCodeLensProvider;
function getTestStatusIcon(status) {
    switch (status) {
        case types_1.TestStatus.Pass: {
            return '✔ ';
        }
        case types_1.TestStatus.Error:
        case types_1.TestStatus.Fail: {
            return '✘ ';
        }
        case types_1.TestStatus.Skipped: {
            return '⃠ ';
        }
        default: {
            return '';
        }
    }
}
function getTestStatusIcons(fns) {
    const statuses = [];
    let count = fns.filter(fn => fn.status === types_1.TestStatus.Pass).length;
    if (count > 0) {
        statuses.push(`✔ ${count}`);
    }
    count = fns.filter(fn => fn.status === types_1.TestStatus.Error || fn.status === types_1.TestStatus.Fail).length;
    if (count > 0) {
        statuses.push(`✘ ${count}`);
    }
    count = fns.filter(fn => fn.status === types_1.TestStatus.Skipped).length;
    if (count > 0) {
        statuses.push(`⃠ ${count}`);
    }
    return statuses.join(' ');
}
function getFunctionCodeLens(file, functionsAndSuites, symbolName, range, symbolContainer) {
    let fn;
    if (symbolContainer.length === 0) {
        fn = functionsAndSuites.functions.find(func => func.name === symbolName);
    }
    else {
        // Assume single levels for now.
        functionsAndSuites.suites
            .filter(s => s.name === symbolContainer)
            .forEach(s => {
            const f = s.functions.find(item => item.name === symbolName);
            if (f) {
                fn = f;
            }
        });
    }
    if (fn) {
        return [
            new vscode_1.CodeLens(range, {
                title: getTestStatusIcon(fn.status) + constants.Text.CodeLensRunUnitTest,
                command: constants.Commands.Tests_Run,
                arguments: [undefined, constants_1.CommandSource.codelens, file, { testFunction: [fn] }]
            }),
            new vscode_1.CodeLens(range, {
                title: getTestStatusIcon(fn.status) + constants.Text.CodeLensDebugUnitTest,
                command: constants.Commands.Tests_Debug,
                arguments: [undefined, constants_1.CommandSource.codelens, file, { testFunction: [fn] }]
            })
        ];
    }
    // Ok, possible we're dealing with parameterized unit tests.
    // If we have [ in the name, then this is a parameterized function.
    const functions = functionsAndSuites.functions.filter(func => func.name.startsWith(`${symbolName}[`) && func.name.endsWith(']'));
    if (functions.length === 0) {
        return [];
    }
    if (functions.length === 0) {
        return [
            new vscode_1.CodeLens(range, {
                title: constants.Text.CodeLensRunUnitTest,
                command: constants.Commands.Tests_Run,
                arguments: [undefined, constants_1.CommandSource.codelens, file, { testFunction: functions }]
            }),
            new vscode_1.CodeLens(range, {
                title: constants.Text.CodeLensDebugUnitTest,
                command: constants.Commands.Tests_Debug,
                arguments: [undefined, constants_1.CommandSource.codelens, file, { testFunction: functions }]
            })
        ];
    }
    // Find all flattened functions.
    return [
        new vscode_1.CodeLens(range, {
            title: `${getTestStatusIcons(functions)}${constants.Text.CodeLensRunUnitTest} (Multiple)`,
            command: constants.Commands.Tests_Picker_UI,
            arguments: [undefined, constants_1.CommandSource.codelens, file, functions]
        }),
        new vscode_1.CodeLens(range, {
            title: `${getTestStatusIcons(functions)}${constants.Text.CodeLensDebugUnitTest} (Multiple)`,
            command: constants.Commands.Tests_Picker_UI_Debug,
            arguments: [undefined, constants_1.CommandSource.codelens, file, functions]
        })
    ];
}
function getAllTestSuitesAndFunctionsPerFile(testFile) {
    // tslint:disable-next-line:prefer-type-cast
    const all = { functions: testFile.functions, suites: [] };
    testFile.suites.forEach(suite => {
        all.suites.push(suite);
        const allChildItems = getAllTestSuitesAndFunctions(suite);
        all.functions.push(...allChildItems.functions);
        all.suites.push(...allChildItems.suites);
    });
    return all;
}
function getAllTestSuitesAndFunctions(testSuite) {
    const all = { functions: [], suites: [] };
    testSuite.functions.forEach(fn => {
        all.functions.push(fn);
    });
    testSuite.suites.forEach(suite => {
        all.suites.push(suite);
        const allChildItems = getAllTestSuitesAndFunctions(suite);
        all.functions.push(...allChildItems.functions);
        all.suites.push(...allChildItems.suites);
    });
    return all;
}
//# sourceMappingURL=testFiles.js.map