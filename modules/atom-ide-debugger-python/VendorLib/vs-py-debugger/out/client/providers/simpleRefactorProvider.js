"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const configSettings_1 = require("../common/configSettings");
const editor_1 = require("../common/editor");
const types_1 = require("../common/types");
const stopWatch_1 = require("../common/utils/stopWatch");
const proxy_1 = require("../refactor/proxy");
const telemetry_1 = require("../telemetry");
const constants_1 = require("../telemetry/constants");
let installer;
function activateSimplePythonRefactorProvider(context, outputChannel, serviceContainer) {
    installer = serviceContainer.get(types_1.IInstaller);
    let disposable = vscode.commands.registerCommand('python.refactorExtractVariable', () => {
        const stopWatch = new stopWatch_1.StopWatch();
        const promise = extractVariable(context.extensionPath, vscode.window.activeTextEditor, vscode.window.activeTextEditor.selection, 
        // tslint:disable-next-line:no-empty
        outputChannel, serviceContainer).catch(() => { });
        telemetry_1.sendTelemetryWhenDone(constants_1.REFACTOR_EXTRACT_VAR, promise, stopWatch);
    });
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('python.refactorExtractMethod', () => {
        const stopWatch = new stopWatch_1.StopWatch();
        const promise = extractMethod(context.extensionPath, vscode.window.activeTextEditor, vscode.window.activeTextEditor.selection, 
        // tslint:disable-next-line:no-empty
        outputChannel, serviceContainer).catch(() => { });
        telemetry_1.sendTelemetryWhenDone(constants_1.REFACTOR_EXTRACT_FUNCTION, promise, stopWatch);
    });
    context.subscriptions.push(disposable);
}
exports.activateSimplePythonRefactorProvider = activateSimplePythonRefactorProvider;
// Exported for unit testing
function extractVariable(extensionDir, textEditor, range, 
// tslint:disable-next-line:no-any
outputChannel, serviceContainer) {
    let workspaceFolder = vscode.workspace.getWorkspaceFolder(textEditor.document.uri);
    if (!workspaceFolder && Array.isArray(vscode.workspace.workspaceFolders) && vscode.workspace.workspaceFolders.length > 0) {
        workspaceFolder = vscode.workspace.workspaceFolders[0];
    }
    const workspaceRoot = workspaceFolder ? workspaceFolder.uri.fsPath : __dirname;
    const pythonSettings = configSettings_1.PythonSettings.getInstance(workspaceFolder ? workspaceFolder.uri : undefined);
    return validateDocumentForRefactor(textEditor).then(() => {
        const newName = `newvariable${new Date().getMilliseconds().toString()}`;
        const proxy = new proxy_1.RefactorProxy(extensionDir, pythonSettings, workspaceRoot, serviceContainer);
        const rename = proxy.extractVariable(textEditor.document, newName, textEditor.document.uri.fsPath, range, textEditor.options).then(response => {
            return response.results[0].diff;
        });
        return extractName(extensionDir, textEditor, range, newName, rename, outputChannel);
    });
}
exports.extractVariable = extractVariable;
// Exported for unit testing
function extractMethod(extensionDir, textEditor, range, 
// tslint:disable-next-line:no-any
outputChannel, serviceContainer) {
    let workspaceFolder = vscode.workspace.getWorkspaceFolder(textEditor.document.uri);
    if (!workspaceFolder && Array.isArray(vscode.workspace.workspaceFolders) && vscode.workspace.workspaceFolders.length > 0) {
        workspaceFolder = vscode.workspace.workspaceFolders[0];
    }
    const workspaceRoot = workspaceFolder ? workspaceFolder.uri.fsPath : __dirname;
    const pythonSettings = configSettings_1.PythonSettings.getInstance(workspaceFolder ? workspaceFolder.uri : undefined);
    return validateDocumentForRefactor(textEditor).then(() => {
        const newName = `newmethod${new Date().getMilliseconds().toString()}`;
        const proxy = new proxy_1.RefactorProxy(extensionDir, pythonSettings, workspaceRoot, serviceContainer);
        const rename = proxy.extractMethod(textEditor.document, newName, textEditor.document.uri.fsPath, range, textEditor.options).then(response => {
            return response.results[0].diff;
        });
        return extractName(extensionDir, textEditor, range, newName, rename, outputChannel);
    });
}
exports.extractMethod = extractMethod;
// tslint:disable-next-line:no-any
function validateDocumentForRefactor(textEditor) {
    if (!textEditor.document.isDirty) {
        return Promise.resolve();
    }
    // tslint:disable-next-line:no-any
    return new Promise((resolve, reject) => {
        vscode.window.showInformationMessage('Please save changes before refactoring', 'Save').then(item => {
            if (item === 'Save') {
                textEditor.document.save().then(resolve, reject);
            }
            else {
                return reject();
            }
        });
    });
}
function extractName(extensionDir, textEditor, range, newName, 
// tslint:disable-next-line:no-any
renameResponse, outputChannel) {
    let changeStartsAtLine = -1;
    return renameResponse.then(diff => {
        if (diff.length === 0) {
            return [];
        }
        return editor_1.getTextEditsFromPatch(textEditor.document.getText(), diff);
    }).then(edits => {
        return textEditor.edit(editBuilder => {
            edits.forEach(edit => {
                if (changeStartsAtLine === -1 || changeStartsAtLine > edit.range.start.line) {
                    changeStartsAtLine = edit.range.start.line;
                }
                editBuilder.replace(edit.range, edit.newText);
            });
        });
    }).then(done => {
        if (done && changeStartsAtLine >= 0) {
            let newWordPosition;
            for (let lineNumber = changeStartsAtLine; lineNumber < textEditor.document.lineCount; lineNumber += 1) {
                const line = textEditor.document.lineAt(lineNumber);
                const indexOfWord = line.text.indexOf(newName);
                if (indexOfWord >= 0) {
                    newWordPosition = new vscode.Position(line.range.start.line, indexOfWord);
                    break;
                }
            }
            if (newWordPosition) {
                textEditor.selections = [new vscode.Selection(newWordPosition, new vscode.Position(newWordPosition.line, newWordPosition.character + newName.length))];
                textEditor.revealRange(new vscode.Range(textEditor.selection.start, textEditor.selection.end), vscode.TextEditorRevealType.Default);
            }
            return newWordPosition;
        }
        return null;
    }).then(newWordPosition => {
        if (newWordPosition) {
            return textEditor.document.save().then(() => {
                // Now that we have selected the new variable, lets invoke the rename command
                return vscode.commands.executeCommand('editor.action.rename');
            });
        }
    }).catch(error => {
        if (error === 'Not installed') {
            installer.promptToInstall(types_1.Product.rope, textEditor.document.uri)
                .catch(ex => console.error('Python Extension: simpleRefactorProvider.promptToInstall', ex));
            return Promise.reject('');
        }
        let errorMessage = `${error}`;
        if (typeof error === 'string') {
            errorMessage = error;
        }
        if (typeof error === 'object' && error.message) {
            errorMessage = error.message;
        }
        outputChannel.appendLine(`${'#'.repeat(10)}Refactor Output${'#'.repeat(10)}`);
        outputChannel.appendLine(`Error in refactoring:\n${errorMessage}`);
        vscode.window.showErrorMessage(`Cannot perform refactoring using selected element(s). (${errorMessage})`);
        return Promise.reject(error);
    });
}
//# sourceMappingURL=simpleRefactorProvider.js.map