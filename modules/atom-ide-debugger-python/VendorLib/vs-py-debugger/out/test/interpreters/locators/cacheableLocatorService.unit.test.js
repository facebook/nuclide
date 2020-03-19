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
// tslint:disable:no-any max-classes-per-file max-func-body-length
const chai_1 = require("chai");
const md5 = require("md5");
const ts_mockito_1 = require("ts-mockito");
const vscode_1 = require("vscode");
const types_1 = require("../../../client/common/application/types");
const workspace_1 = require("../../../client/common/application/workspace");
const misc_1 = require("../../../client/common/utils/misc");
const cacheableLocatorService_1 = require("../../../client/interpreter/locators/services/cacheableLocatorService");
const container_1 = require("../../../client/ioc/container");
suite('Interpreters - Cacheable Locator Service', () => {
    suite('Caching', () => {
        class Locator extends cacheableLocatorService_1.CacheableLocatorService {
            constructor(name, serviceCcontainer, mockLocator) {
                super(name, serviceCcontainer);
                this.mockLocator = mockLocator;
            }
            dispose() {
                misc_1.noop();
            }
            getInterpretersImplementation(resource) {
                return __awaiter(this, void 0, void 0, function* () {
                    return this.mockLocator.getInterpretersImplementation();
                });
            }
            getCachedInterpreters(resource) {
                return this.mockLocator.getCachedInterpreters();
            }
            cacheInterpreters(interpreters, resource) {
                return __awaiter(this, void 0, void 0, function* () {
                    return this.mockLocator.cacheInterpreters();
                });
            }
            getCacheKey(resource) {
                return this.mockLocator.getCacheKey();
            }
        }
        class MockLocator {
            getInterpretersImplementation() {
                return __awaiter(this, void 0, void 0, function* () {
                    return [];
                });
            }
            getCachedInterpreters() {
                return;
            }
            cacheInterpreters() {
                return __awaiter(this, void 0, void 0, function* () {
                    return;
                });
            }
            getCacheKey() {
                return '';
            }
        }
        let serviceContainer;
        setup(() => {
            serviceContainer = ts_mockito_1.mock(container_1.ServiceContainer);
        });
        test('Interpreters must be retrieved once, then cached', () => __awaiter(this, void 0, void 0, function* () {
            const expectedInterpreters = [1, 2];
            const mockedLocatorForVerification = ts_mockito_1.mock(MockLocator);
            const locator = new class extends Locator {
                addHandlersForInterpreterWatchers(cacheKey, resource) {
                    return __awaiter(this, void 0, void 0, function* () {
                        misc_1.noop();
                    });
                }
            }('dummy', ts_mockito_1.instance(serviceContainer), ts_mockito_1.instance(mockedLocatorForVerification));
            ts_mockito_1.when(mockedLocatorForVerification.getInterpretersImplementation()).thenResolve(expectedInterpreters);
            ts_mockito_1.when(mockedLocatorForVerification.getCacheKey()).thenReturn('xyz');
            ts_mockito_1.when(mockedLocatorForVerification.getCachedInterpreters()).thenResolve();
            const [items1, items2, items3] = yield Promise.all([locator.getInterpreters(), locator.getInterpreters(), locator.getInterpreters()]);
            chai_1.expect(items1).to.be.deep.equal(expectedInterpreters);
            chai_1.expect(items2).to.be.deep.equal(expectedInterpreters);
            chai_1.expect(items3).to.be.deep.equal(expectedInterpreters);
            ts_mockito_1.verify(mockedLocatorForVerification.getInterpretersImplementation()).once();
            ts_mockito_1.verify(mockedLocatorForVerification.getCachedInterpreters()).atLeast(1);
            ts_mockito_1.verify(mockedLocatorForVerification.cacheInterpreters()).atLeast(1);
        }));
        test('Ensure onDidCreate event handler is attached', () => __awaiter(this, void 0, void 0, function* () {
            const mockedLocatorForVerification = ts_mockito_1.mock(MockLocator);
            class Watcher {
                onDidCreate(listener, thisArgs, disposables) {
                    return { dispose: misc_1.noop };
                }
            }
            const watcher = ts_mockito_1.mock(Watcher);
            const locator = new class extends Locator {
                getInterpreterWatchers(_resource) {
                    return __awaiter(this, void 0, void 0, function* () {
                        return [ts_mockito_1.instance(watcher)];
                    });
                }
            }('dummy', ts_mockito_1.instance(serviceContainer), ts_mockito_1.instance(mockedLocatorForVerification));
            yield locator.getInterpreters();
            ts_mockito_1.verify(watcher.onDidCreate(ts_mockito_1.anything(), ts_mockito_1.anything(), ts_mockito_1.anything())).once();
        }));
        test('Ensure cache is cleared when watcher event fires', () => __awaiter(this, void 0, void 0, function* () {
            const expectedInterpreters = [1, 2];
            const mockedLocatorForVerification = ts_mockito_1.mock(MockLocator);
            class Watcher {
                onDidCreate(listener, thisArgs, disposables) {
                    this.listner = listener;
                    return { dispose: misc_1.noop };
                }
                invokeListeners() {
                    this.listner(undefined);
                }
            }
            const watcher = new Watcher();
            const locator = new class extends Locator {
                getInterpreterWatchers(_resource) {
                    return __awaiter(this, void 0, void 0, function* () {
                        return [watcher];
                    });
                }
            }('dummy', ts_mockito_1.instance(serviceContainer), ts_mockito_1.instance(mockedLocatorForVerification));
            ts_mockito_1.when(mockedLocatorForVerification.getInterpretersImplementation()).thenResolve(expectedInterpreters);
            ts_mockito_1.when(mockedLocatorForVerification.getCacheKey()).thenReturn('xyz');
            ts_mockito_1.when(mockedLocatorForVerification.getCachedInterpreters()).thenResolve();
            const [items1, items2, items3] = yield Promise.all([locator.getInterpreters(), locator.getInterpreters(), locator.getInterpreters()]);
            chai_1.expect(items1).to.be.deep.equal(expectedInterpreters);
            chai_1.expect(items2).to.be.deep.equal(expectedInterpreters);
            chai_1.expect(items3).to.be.deep.equal(expectedInterpreters);
            ts_mockito_1.verify(mockedLocatorForVerification.getInterpretersImplementation()).once();
            ts_mockito_1.verify(mockedLocatorForVerification.getCachedInterpreters()).atLeast(1);
            ts_mockito_1.verify(mockedLocatorForVerification.cacheInterpreters()).once();
            watcher.invokeListeners();
            const [items4, items5, items6] = yield Promise.all([locator.getInterpreters(), locator.getInterpreters(), locator.getInterpreters()]);
            chai_1.expect(items4).to.be.deep.equal(expectedInterpreters);
            chai_1.expect(items5).to.be.deep.equal(expectedInterpreters);
            chai_1.expect(items6).to.be.deep.equal(expectedInterpreters);
            // We must get the list of interperters again and cache the new result again.
            ts_mockito_1.verify(mockedLocatorForVerification.getInterpretersImplementation()).twice();
            ts_mockito_1.verify(mockedLocatorForVerification.cacheInterpreters()).twice();
        }));
        test('Ensure locating event is raised', () => __awaiter(this, void 0, void 0, function* () {
            const mockedLocatorForVerification = ts_mockito_1.mock(MockLocator);
            const locator = new class extends Locator {
                getInterpreterWatchers(_resource) {
                    return __awaiter(this, void 0, void 0, function* () {
                        return [];
                    });
                }
            }('dummy', ts_mockito_1.instance(serviceContainer), ts_mockito_1.instance(mockedLocatorForVerification));
            let locatingEventRaised = false;
            locator.onLocating(() => locatingEventRaised = true);
            ts_mockito_1.when(mockedLocatorForVerification.getInterpretersImplementation()).thenResolve([1, 2]);
            ts_mockito_1.when(mockedLocatorForVerification.getCacheKey()).thenReturn('xyz');
            ts_mockito_1.when(mockedLocatorForVerification.getCachedInterpreters()).thenResolve();
            yield locator.getInterpreters();
            chai_1.expect(locatingEventRaised).to.be.equal(true, 'Locating Event not raised');
        }));
    });
    suite('Cache Key', () => {
        class Locator extends cacheableLocatorService_1.CacheableLocatorService {
            dispose() {
                misc_1.noop();
            }
            // tslint:disable-next-line:no-unnecessary-override
            getCacheKey(resource) {
                return super.getCacheKey(resource);
            }
            getInterpretersImplementation(resource) {
                return __awaiter(this, void 0, void 0, function* () {
                    return [];
                });
            }
            getCachedInterpreters(resource) {
                return [];
            }
            cacheInterpreters(interpreters, resource) {
                return __awaiter(this, void 0, void 0, function* () {
                    misc_1.noop();
                });
            }
        }
        let serviceContainer;
        setup(() => {
            serviceContainer = ts_mockito_1.mock(container_1.ServiceContainer);
        });
        test('Cache Key must contain name of locator', () => __awaiter(this, void 0, void 0, function* () {
            const locator = new Locator('hello-World', ts_mockito_1.instance(serviceContainer));
            const key = locator.getCacheKey();
            chai_1.expect(key).contains('hello-World');
        }));
        test('Cache Key must not contain path to workspace', () => __awaiter(this, void 0, void 0, function* () {
            const workspace = ts_mockito_1.mock(workspace_1.WorkspaceService);
            const workspaceFolder = { name: '1', index: 1, uri: vscode_1.Uri.file(__dirname) };
            ts_mockito_1.when(workspace.hasWorkspaceFolders).thenReturn(true);
            ts_mockito_1.when(workspace.workspaceFolders).thenReturn([workspaceFolder]);
            ts_mockito_1.when(workspace.getWorkspaceFolder(ts_mockito_1.anything())).thenReturn(workspaceFolder);
            ts_mockito_1.when(serviceContainer.get(types_1.IWorkspaceService)).thenReturn(ts_mockito_1.instance(workspace));
            ts_mockito_1.when(serviceContainer.get(types_1.IWorkspaceService, ts_mockito_1.anything())).thenReturn(ts_mockito_1.instance(workspace));
            const locator = new Locator('hello-World', ts_mockito_1.instance(serviceContainer), false);
            const key = locator.getCacheKey(vscode_1.Uri.file('something'));
            chai_1.expect(key).contains('hello-World');
            chai_1.expect(key).not.contains(md5(workspaceFolder.uri.fsPath));
        }));
        test('Cache Key must contain path to workspace', () => __awaiter(this, void 0, void 0, function* () {
            const workspace = ts_mockito_1.mock(workspace_1.WorkspaceService);
            const workspaceFolder = { name: '1', index: 1, uri: vscode_1.Uri.file(__dirname) };
            const resource = vscode_1.Uri.file('a');
            ts_mockito_1.when(workspace.hasWorkspaceFolders).thenReturn(true);
            ts_mockito_1.when(workspace.workspaceFolders).thenReturn([workspaceFolder]);
            ts_mockito_1.when(workspace.getWorkspaceFolder(resource)).thenReturn(workspaceFolder);
            ts_mockito_1.when(serviceContainer.get(types_1.IWorkspaceService)).thenReturn(ts_mockito_1.instance(workspace));
            ts_mockito_1.when(serviceContainer.get(types_1.IWorkspaceService, ts_mockito_1.anything())).thenReturn(ts_mockito_1.instance(workspace));
            const locator = new Locator('hello-World', ts_mockito_1.instance(serviceContainer), true);
            const key = locator.getCacheKey(resource);
            chai_1.expect(key).contains('hello-World');
            chai_1.expect(key).contains(md5(workspaceFolder.uri.fsPath));
        }));
    });
});
//# sourceMappingURL=cacheableLocatorService.unit.test.js.map