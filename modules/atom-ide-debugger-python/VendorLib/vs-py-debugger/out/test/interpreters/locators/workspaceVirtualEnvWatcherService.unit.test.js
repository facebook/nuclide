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
// tslint:disable:no-any max-classes-per-file max-func-body-length no-invalid-this
const chai_1 = require("chai");
const path = require("path");
const ts_mockito_1 = require("ts-mockito");
const vscode_1 = require("vscode");
const workspace_1 = require("../../../client/common/application/workspace");
const constants_1 = require("../../../client/common/constants");
const platformService_1 = require("../../../client/common/platform/platformService");
const pythonExecutionFactory_1 = require("../../../client/common/process/pythonExecutionFactory");
const async_1 = require("../../../client/common/utils/async");
const misc_1 = require("../../../client/common/utils/misc");
const platform_1 = require("../../../client/common/utils/platform");
const workspaceVirtualEnvWatcherService_1 = require("../../../client/interpreter/locators/services/workspaceVirtualEnvWatcherService");
suite('Interpreters - Workspace VirtualEnv Watcher Service', () => {
    let disposables = [];
    setup(function () {
        if (!constants_1.isUnitTestExecution()) {
            return this.skip();
        }
    });
    teardown(() => {
        disposables.forEach(d => {
            try {
                d.dispose();
            }
            catch (_a) {
                misc_1.noop();
            }
        });
        disposables = [];
    });
    function checkForFileChanges(os, resource, hasWorkspaceFolder) {
        return __awaiter(this, void 0, void 0, function* () {
            const workspaceService = ts_mockito_1.mock(workspace_1.WorkspaceService);
            const platformService = ts_mockito_1.mock(platformService_1.PlatformService);
            const execFactory = ts_mockito_1.mock(pythonExecutionFactory_1.PythonExecutionFactory);
            const watcher = new workspaceVirtualEnvWatcherService_1.WorkspaceVirtualEnvWatcherService([], ts_mockito_1.instance(workspaceService), ts_mockito_1.instance(platformService), ts_mockito_1.instance(execFactory));
            ts_mockito_1.when(platformService.isWindows).thenReturn(os === platform_1.OSType.Windows);
            ts_mockito_1.when(platformService.isLinux).thenReturn(os === platform_1.OSType.Linux);
            ts_mockito_1.when(platformService.isMac).thenReturn(os === platform_1.OSType.OSX);
            class FSWatcher {
                onDidCreate(_listener, _thisArgs, _disposables) {
                    return { dispose: misc_1.noop };
                }
            }
            const workspaceFolder = { name: 'one', index: 1, uri: vscode_1.Uri.file(path.join('root', 'dev')) };
            if (!hasWorkspaceFolder || !resource) {
                ts_mockito_1.when(workspaceService.getWorkspaceFolder(ts_mockito_1.anything())).thenReturn(undefined);
            }
            else {
                ts_mockito_1.when(workspaceService.getWorkspaceFolder(resource)).thenReturn(workspaceFolder);
            }
            const fsWatcher = ts_mockito_1.mock(FSWatcher);
            ts_mockito_1.when(workspaceService.createFileSystemWatcher(ts_mockito_1.anything())).thenReturn(ts_mockito_1.instance(fsWatcher));
            yield watcher.register(resource);
            ts_mockito_1.verify(workspaceService.createFileSystemWatcher(ts_mockito_1.anything())).twice();
            ts_mockito_1.verify(fsWatcher.onDidCreate(ts_mockito_1.anything(), ts_mockito_1.anything(), ts_mockito_1.anything())).twice();
        });
    }
    for (const uri of [undefined, vscode_1.Uri.file('abc')]) {
        for (const hasWorkspaceFolder of [true, false]) {
            const uriSuffix = uri ? ` (with resource & ${hasWorkspaceFolder ? 'with' : 'without'} workspace folder)` : '';
            test(`Register for file changes on windows ${uriSuffix}`, () => __awaiter(this, void 0, void 0, function* () {
                yield checkForFileChanges(platform_1.OSType.Windows, uri, hasWorkspaceFolder);
            }));
            test(`Register for file changes on Mac ${uriSuffix}`, () => __awaiter(this, void 0, void 0, function* () {
                yield checkForFileChanges(platform_1.OSType.OSX, uri, hasWorkspaceFolder);
            }));
            test(`Register for file changes on Linux ${uriSuffix}`, () => __awaiter(this, void 0, void 0, function* () {
                yield checkForFileChanges(platform_1.OSType.Linux, uri, hasWorkspaceFolder);
            }));
        }
    }
    function ensureFileChanesAreHandled(os) {
        return __awaiter(this, void 0, void 0, function* () {
            const workspaceService = ts_mockito_1.mock(workspace_1.WorkspaceService);
            const platformService = ts_mockito_1.mock(platformService_1.PlatformService);
            const execFactory = ts_mockito_1.mock(pythonExecutionFactory_1.PythonExecutionFactory);
            const watcher = new workspaceVirtualEnvWatcherService_1.WorkspaceVirtualEnvWatcherService(disposables, ts_mockito_1.instance(workspaceService), ts_mockito_1.instance(platformService), ts_mockito_1.instance(execFactory));
            ts_mockito_1.when(platformService.isWindows).thenReturn(os === platform_1.OSType.Windows);
            ts_mockito_1.when(platformService.isLinux).thenReturn(os === platform_1.OSType.Linux);
            ts_mockito_1.when(platformService.isMac).thenReturn(os === platform_1.OSType.OSX);
            class FSWatcher {
                onDidCreate(listener, _thisArgs, _disposables) {
                    this.listener = listener;
                    return { dispose: misc_1.noop };
                }
                invokeListener(e) {
                    this.listener(e);
                }
            }
            const fsWatcher = new FSWatcher();
            ts_mockito_1.when(workspaceService.getWorkspaceFolder(ts_mockito_1.anything())).thenReturn(undefined);
            ts_mockito_1.when(workspaceService.createFileSystemWatcher(ts_mockito_1.anything())).thenReturn(fsWatcher);
            yield watcher.register(undefined);
            let invoked = false;
            watcher.onDidCreate(() => invoked = true, watcher);
            fsWatcher.invokeListener(vscode_1.Uri.file(''));
            // We need this sleep, as we have a debounce (so lets wait).
            yield async_1.sleep(10);
            chai_1.expect(invoked).to.be.equal(true, 'invalid');
        });
    }
    test('Check file change handler on Windows', () => __awaiter(this, void 0, void 0, function* () {
        yield ensureFileChanesAreHandled(platform_1.OSType.Windows);
    }));
    test('Check file change handler on Mac', () => __awaiter(this, void 0, void 0, function* () {
        yield ensureFileChanesAreHandled(platform_1.OSType.OSX);
    }));
    test('Check file change handler on Linux', () => __awaiter(this, void 0, void 0, function* () {
        yield ensureFileChanesAreHandled(platform_1.OSType.Linux);
    }));
});
//# sourceMappingURL=workspaceVirtualEnvWatcherService.unit.test.js.map