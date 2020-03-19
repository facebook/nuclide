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
const assert = require("assert");
const enzyme_1 = require("enzyme");
const React = require("react");
const TypeMoq = require("typemoq");
const types_1 = require("../../client/common/application/types");
const types_2 = require("../../client/datascience/types");
const MainPanel_1 = require("../../datascience-ui/history-react/MainPanel");
const dataScienceIocContainer_1 = require("./dataScienceIocContainer");
const reactHelpers_1 = require("./reactHelpers");
// tslint:disable-next-line:max-func-body-length
suite('History output tests', () => {
    const disposables = [];
    let jupyterExecution;
    let webPanelProvider;
    let webPanel;
    let historyProvider;
    let webPanelListener;
    let globalAcquireVsCodeApi;
    let ioc;
    setup(() => {
        ioc = new dataScienceIocContainer_1.DataScienceIocContainer();
        ioc.registerDataScienceTypes();
        webPanelProvider = TypeMoq.Mock.ofType();
        webPanel = TypeMoq.Mock.ofType();
        ioc.serviceManager.addSingletonInstance(types_1.IWebPanelProvider, webPanelProvider.object);
        // Setup the webpanel provider so that it returns our dummy web panel. It will have to talk to our global JSDOM window so that the react components can link into it
        webPanelProvider.setup(p => p.create(TypeMoq.It.isAny(), TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString())).returns((listener, title, script, css) => {
            // Keep track of the current listener. It listens to messages through the vscode api
            webPanelListener = listener;
            // Return our dummy web panel
            return webPanel.object;
        });
        webPanel.setup(p => p.postMessage(TypeMoq.It.isAny())).callback((m) => window.postMessage(m, '*')); // See JSDOM valid target origins
        webPanel.setup(p => p.show());
        jupyterExecution = ioc.serviceManager.get(types_2.IJupyterExecution);
        historyProvider = ioc.serviceManager.get(types_2.IHistoryProvider);
        // Setup a global for the acquireVsCodeApi so that the React PostOffice can find it
        globalAcquireVsCodeApi = () => {
            return {
                // tslint:disable-next-line:no-any
                postMessage: (msg) => {
                    if (webPanelListener) {
                        webPanelListener.onMessage(msg.type, msg.payload);
                    }
                },
                // tslint:disable-next-line:no-any no-empty
                setState: (msg) => {
                },
                // tslint:disable-next-line:no-any no-empty
                getState: () => {
                    return {};
                }
            };
        };
        // tslint:disable-next-line:no-string-literal
        global['acquireVsCodeApi'] = globalAcquireVsCodeApi;
    });
    teardown(() => {
        disposables.forEach(disposable => {
            if (disposable) {
                disposable.dispose();
            }
        });
        ioc.dispose();
        delete global['ascquireVsCodeApi'];
    });
    test('Simple text', () => __awaiter(this, void 0, void 0, function* () {
        if (yield jupyterExecution.isNotebookSupported()) {
            // Create our main panel and tie it into the JSDOM. Ignore progress so we only get a single render
            const wrapper = enzyme_1.mount(React.createElement(MainPanel_1.MainPanel, { theme: 'vscode-light', ignoreProgress: true, skipDefault: true }));
            // Get an update promise so we can wait for the add code
            const updatePromise = reactHelpers_1.waitForUpdate(wrapper, MainPanel_1.MainPanel);
            // Send some code to the history and make sure it ends up in the html returned from our render
            const history = historyProvider.active;
            yield history.addCode('a=1\na', 'foo.py', 2);
            // Wait for the render to go through
            yield updatePromise;
            const foundResult = wrapper.find('Cell');
            assert.equal(foundResult.length, 1, 'Didn\'t find any cells being rendered');
        }
        else {
            // tslint:disable-next-line:no-console
            console.log('History test skipped, no Jupyter installed');
        }
    })).timeout(60000);
    test('Loc React test', () => __awaiter(this, void 0, void 0, function* () {
        // Create our main panel and tie it into the JSDOM
        const wrapper = enzyme_1.mount(React.createElement(MainPanel_1.MainPanel, { theme: 'vscode-light', skipDefault: false }));
        // Our cell should have been rendered. It should have a method to get a loc string
        const cellFound = wrapper.find('Cell');
        const cell = cellFound.at(0).instance();
        assert.equal(cell.getUnknownMimeTypeString(), 'Unknown mime type from helper', 'Unknown mime type did not come from script');
    }));
    test('Dispose test', () => __awaiter(this, void 0, void 0, function* () {
        // tslint:disable-next-line:no-any
        if (yield jupyterExecution.isNotebookSupported()) {
            const history = historyProvider.active;
            yield history.show(); // Have to wait for the load to finish
            history.dispose();
            // tslint:disable-next-line:no-any
            const h2 = historyProvider.active;
            // Check equal and then dispose so the test goes away
            const equal = Object.is(history, h2);
            yield h2.show();
            assert.ok(!equal, 'Disposing is not removing the active history');
        }
        else {
            // tslint:disable-next-line:no-console
            console.log('History test skipped, no Jupyter installed');
        }
    }));
    // Tests to do:
    // 1) Cell output works on different mime types. Could just use a notebook to drive
    // 2) History commands work (export/restart/clear all)
    // 3) Jupyter server commands work (open notebook)
    // 4) Changing directories or loading from different directories
    // 5) Telemetry
});
//# sourceMappingURL=history.functional.test.js.map