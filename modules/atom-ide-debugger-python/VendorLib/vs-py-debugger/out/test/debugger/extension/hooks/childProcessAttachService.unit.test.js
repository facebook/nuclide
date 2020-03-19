// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
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
// tslint:disable:no-any max-func-body-length
const chai_1 = require("chai");
const ts_mockito_1 = require("ts-mockito");
const vscode_1 = require("vscode");
const applicationShell_1 = require("../../../../client/common/application/applicationShell");
const debugService_1 = require("../../../../client/common/application/debugService");
const workspace_1 = require("../../../../client/common/application/workspace");
const childProcessAttachService_1 = require("../../../../client/debugger/extension/hooks/childProcessAttachService");
suite('Debug - Attach to Child Process', () => {
    test('Message is not displayed if debugger is launched', () => __awaiter(this, void 0, void 0, function* () {
        const shell = ts_mockito_1.mock(applicationShell_1.ApplicationShell);
        const debugService = ts_mockito_1.mock(debugService_1.DebugService);
        const workspaceService = ts_mockito_1.mock(workspace_1.WorkspaceService);
        const service = new childProcessAttachService_1.ChildProcessAttachService(ts_mockito_1.instance(shell), ts_mockito_1.instance(debugService), ts_mockito_1.instance(workspaceService));
        const args = {
            request: 'launch',
            type: 'python',
            name: ''
        };
        const data = {
            rootProcessId: 1,
            parentProcessId: 1,
            port: 1234,
            processId: 2,
            rootStartRequest: {
                seq: 1,
                type: 'python',
                arguments: args,
                command: 'request'
            }
        };
        ts_mockito_1.when(workspaceService.hasWorkspaceFolders).thenReturn(false);
        ts_mockito_1.when(debugService.startDebugging(ts_mockito_1.anything(), ts_mockito_1.anything())).thenResolve(true);
        yield service.attach(data);
        ts_mockito_1.verify(workspaceService.hasWorkspaceFolders).once();
        ts_mockito_1.verify(debugService.startDebugging(ts_mockito_1.anything(), ts_mockito_1.anything())).once();
    }));
    test('Message is displayed if debugger is not launched', () => __awaiter(this, void 0, void 0, function* () {
        const shell = ts_mockito_1.mock(applicationShell_1.ApplicationShell);
        const debugService = ts_mockito_1.mock(debugService_1.DebugService);
        const workspaceService = ts_mockito_1.mock(workspace_1.WorkspaceService);
        const service = new childProcessAttachService_1.ChildProcessAttachService(ts_mockito_1.instance(shell), ts_mockito_1.instance(debugService), ts_mockito_1.instance(workspaceService));
        const args = {
            request: 'launch',
            type: 'python',
            name: ''
        };
        const data = {
            rootProcessId: 1,
            parentProcessId: 1,
            port: 1234,
            processId: 2,
            rootStartRequest: {
                seq: 1,
                type: 'python',
                arguments: args,
                command: 'request'
            }
        };
        ts_mockito_1.when(workspaceService.hasWorkspaceFolders).thenReturn(false);
        ts_mockito_1.when(debugService.startDebugging(ts_mockito_1.anything(), ts_mockito_1.anything())).thenResolve(false);
        ts_mockito_1.when(shell.showErrorMessage(ts_mockito_1.anything())).thenResolve();
        yield service.attach(data);
        ts_mockito_1.verify(workspaceService.hasWorkspaceFolders).once();
        ts_mockito_1.verify(debugService.startDebugging(ts_mockito_1.anything(), ts_mockito_1.anything())).once();
        ts_mockito_1.verify(shell.showErrorMessage(ts_mockito_1.anything())).once();
    }));
    test('Use correct workspace folder', () => __awaiter(this, void 0, void 0, function* () {
        const shell = ts_mockito_1.mock(applicationShell_1.ApplicationShell);
        const debugService = ts_mockito_1.mock(debugService_1.DebugService);
        const workspaceService = ts_mockito_1.mock(workspace_1.WorkspaceService);
        const service = new childProcessAttachService_1.ChildProcessAttachService(ts_mockito_1.instance(shell), ts_mockito_1.instance(debugService), ts_mockito_1.instance(workspaceService));
        const rightWorkspaceFolder = { name: '1', index: 1, uri: vscode_1.Uri.file('a') };
        const wkspace1 = { name: '0', index: 0, uri: vscode_1.Uri.file('0') };
        const wkspace2 = { name: '2', index: 2, uri: vscode_1.Uri.file('2') };
        const args = {
            request: 'launch',
            type: 'python',
            name: '',
            workspaceFolder: rightWorkspaceFolder.uri.fsPath
        };
        const data = {
            rootProcessId: 1,
            parentProcessId: 1,
            port: 1234,
            processId: 2,
            rootStartRequest: {
                seq: 1,
                type: 'python',
                arguments: args,
                command: 'request'
            }
        };
        ts_mockito_1.when(workspaceService.hasWorkspaceFolders).thenReturn(true);
        ts_mockito_1.when(workspaceService.workspaceFolders).thenReturn([wkspace1, rightWorkspaceFolder, wkspace2]);
        ts_mockito_1.when(debugService.startDebugging(rightWorkspaceFolder, ts_mockito_1.anything())).thenResolve(true);
        yield service.attach(data);
        ts_mockito_1.verify(workspaceService.hasWorkspaceFolders).once();
        ts_mockito_1.verify(debugService.startDebugging(rightWorkspaceFolder, ts_mockito_1.anything())).once();
        ts_mockito_1.verify(shell.showErrorMessage(ts_mockito_1.anything())).never();
    }));
    test('Use empty workspace folder if right one is not found', () => __awaiter(this, void 0, void 0, function* () {
        const shell = ts_mockito_1.mock(applicationShell_1.ApplicationShell);
        const debugService = ts_mockito_1.mock(debugService_1.DebugService);
        const workspaceService = ts_mockito_1.mock(workspace_1.WorkspaceService);
        const service = new childProcessAttachService_1.ChildProcessAttachService(ts_mockito_1.instance(shell), ts_mockito_1.instance(debugService), ts_mockito_1.instance(workspaceService));
        const rightWorkspaceFolder = { name: '1', index: 1, uri: vscode_1.Uri.file('a') };
        const wkspace1 = { name: '0', index: 0, uri: vscode_1.Uri.file('0') };
        const wkspace2 = { name: '2', index: 2, uri: vscode_1.Uri.file('2') };
        const args = {
            request: 'launch',
            type: 'python',
            name: '',
            workspaceFolder: rightWorkspaceFolder.uri.fsPath
        };
        const data = {
            rootProcessId: 1,
            parentProcessId: 1,
            port: 1234,
            processId: 2,
            rootStartRequest: {
                seq: 1,
                type: 'python',
                arguments: args,
                command: 'request'
            }
        };
        ts_mockito_1.when(workspaceService.hasWorkspaceFolders).thenReturn(true);
        ts_mockito_1.when(workspaceService.workspaceFolders).thenReturn([wkspace1, wkspace2]);
        ts_mockito_1.when(debugService.startDebugging(undefined, ts_mockito_1.anything())).thenResolve(true);
        yield service.attach(data);
        ts_mockito_1.verify(workspaceService.hasWorkspaceFolders).once();
        ts_mockito_1.verify(debugService.startDebugging(undefined, ts_mockito_1.anything())).once();
        ts_mockito_1.verify(shell.showErrorMessage(ts_mockito_1.anything())).never();
    }));
    test('Validate debug config when parent/root parent was launched', () => __awaiter(this, void 0, void 0, function* () {
        const shell = ts_mockito_1.mock(applicationShell_1.ApplicationShell);
        const debugService = ts_mockito_1.mock(debugService_1.DebugService);
        const workspaceService = ts_mockito_1.mock(workspace_1.WorkspaceService);
        const service = new childProcessAttachService_1.ChildProcessAttachService(ts_mockito_1.instance(shell), ts_mockito_1.instance(debugService), ts_mockito_1.instance(workspaceService));
        const args = {
            request: 'launch',
            type: 'python',
            name: ''
        };
        const data = {
            rootProcessId: 1,
            parentProcessId: 1,
            port: 1234,
            processId: 2,
            rootStartRequest: {
                seq: 1,
                type: 'python',
                arguments: args,
                command: 'request'
            }
        };
        const debugConfig = JSON.parse(JSON.stringify(args));
        debugConfig.host = 'localhost';
        debugConfig.port = data.port;
        debugConfig.name = `Child Process ${data.processId}`;
        debugConfig.request = 'attach';
        ts_mockito_1.when(workspaceService.hasWorkspaceFolders).thenReturn(false);
        ts_mockito_1.when(debugService.startDebugging(undefined, ts_mockito_1.anything())).thenResolve(true);
        // when(debugService.startDebugging(undefined, debugConfig)).thenResolve(true as any);
        yield service.attach(data);
        ts_mockito_1.verify(workspaceService.hasWorkspaceFolders).once();
        ts_mockito_1.verify(debugService.startDebugging(undefined, ts_mockito_1.anything())).once();
        const [, secondArg] = ts_mockito_1.capture(debugService.startDebugging).last();
        chai_1.expect(secondArg).to.deep.equal(debugConfig);
        ts_mockito_1.verify(shell.showErrorMessage(ts_mockito_1.anything())).never();
    }));
    test('Validate debug config when parent/root parent was attached', () => __awaiter(this, void 0, void 0, function* () {
        const shell = ts_mockito_1.mock(applicationShell_1.ApplicationShell);
        const debugService = ts_mockito_1.mock(debugService_1.DebugService);
        const workspaceService = ts_mockito_1.mock(workspace_1.WorkspaceService);
        const service = new childProcessAttachService_1.ChildProcessAttachService(ts_mockito_1.instance(shell), ts_mockito_1.instance(debugService), ts_mockito_1.instance(workspaceService));
        const args = {
            request: 'attach',
            type: 'python',
            name: '',
            host: '123.123.123.123'
        };
        const data = {
            rootProcessId: 1,
            parentProcessId: 1,
            port: 1234,
            processId: 2,
            rootStartRequest: {
                seq: 1,
                type: 'python',
                arguments: args,
                command: 'request'
            }
        };
        const debugConfig = JSON.parse(JSON.stringify(args));
        debugConfig.host = args.host;
        debugConfig.port = data.port;
        debugConfig.name = `Child Process ${data.processId}`;
        debugConfig.request = 'attach';
        ts_mockito_1.when(workspaceService.hasWorkspaceFolders).thenReturn(false);
        ts_mockito_1.when(debugService.startDebugging(undefined, ts_mockito_1.anything())).thenResolve(true);
        // when(debugService.startDebugging(undefined, debugConfig)).thenResolve(true as any);
        yield service.attach(data);
        ts_mockito_1.verify(workspaceService.hasWorkspaceFolders).once();
        ts_mockito_1.verify(debugService.startDebugging(undefined, ts_mockito_1.anything())).once();
        const [, secondArg] = ts_mockito_1.capture(debugService.startDebugging).last();
        chai_1.expect(secondArg).to.deep.equal(debugConfig);
        ts_mockito_1.verify(shell.showErrorMessage(ts_mockito_1.anything())).never();
    }));
});
//# sourceMappingURL=childProcessAttachService.unit.test.js.map