"use strict";
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const initialConfigurations = [
    {
        name: "Launch Program",
        type: "node2",
        request: "launch",
        program: "${workspaceFolder}/app.js",
        cwd: "${workspaceFolder}"
    },
    {
        name: "Attach to Process",
        type: "node2",
        request: "attach",
        port: 9229
    }
];
function activate(context) {
    context.subscriptions.push(vscode.commands.registerCommand('extension.node-debug2.provideInitialConfigurations', provideInitialConfigurations));
    context.subscriptions.push(vscode.commands.registerCommand('extension.node-debug2.toggleSkippingFile', toggleSkippingFile));
}
exports.activate = activate;
function deactivate() {
}
exports.deactivate = deactivate;
function provideInitialConfigurations() {
    let program = getProgram();
    if (program) {
        program = path.isAbsolute(program) ? program : path.join('${workspaceFolder}', program);
        initialConfigurations.forEach(config => {
            if (config['program']) {
                config['program'] = program;
            }
        });
    }
    // If this looks like a typescript/coffeescript workspace, add sourcemap-related props
    if (vscode.workspace.textDocuments.some(document => document.languageId === 'typescript' || document.languageId === 'coffeescript')) {
        initialConfigurations.forEach(config => {
            config['outFiles'] = [];
        });
    }
    // Massage the configuration string, add an aditional tab and comment out processId
    const configurationsMassaged = JSON.stringify(initialConfigurations, null, '\t').replace(',\n\t\t"processId', '\n\t\t//"processId')
        .split('\n').map(line => '\t' + line).join('\n').trim();
    return [
        '{',
        '\t// Use IntelliSense to find out which attributes exist for node debugging',
        '\t// Use hover for the description of the existing attributes',
        '\t// For further information visit https://go.microsoft.com/fwlink/?linkid=830387',
        '\t"version": "0.2.0",',
        '\t"configurations": ' + configurationsMassaged,
        '}'
    ].join('\n');
}
function getProgram() {
    const packageJsonPath = path.join(vscode.workspace.rootPath, 'package.json');
    let program = '';
    // Get 'program' from package.json 'main' or 'npm start'
    try {
        const jsonContent = fs.readFileSync(packageJsonPath, 'utf8');
        const jsonObject = JSON.parse(jsonContent);
        if (jsonObject.main) {
            program = jsonObject.main;
        }
        else if (jsonObject.scripts && typeof jsonObject.scripts.start === 'string') {
            program = jsonObject.scripts.start.split(' ').pop();
        }
    }
    catch (error) { }
    return program;
}
function toggleSkippingFile(path) {
    if (!path) {
        const activeEditor = vscode.window.activeTextEditor;
        path = activeEditor && activeEditor.document.fileName;
    }
    const args = typeof path === 'string' ? { path } : { sourceReference: path };
    vscode.commands.executeCommand('workbench.customDebugRequest', 'toggleSkipFileStatus', args);
}

//# sourceMappingURL=extension.js.map
