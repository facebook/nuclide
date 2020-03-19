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
const fs = require("fs-extra");
const path = require("path");
const constants_1 = require("../../client/common/constants");
const types_1 = require("../../client/common/platform/types");
const jupyterExecution_1 = require("../../client/datascience/jupyterExecution");
const jupyterProcess_1 = require("../../client/datascience/jupyterProcess");
const types_2 = require("../../client/datascience/types");
const cell_1 = require("../../datascience-ui/history-react/cell");
const mainPanelState_1 = require("../../datascience-ui/history-react/mainPanelState");
const dataScienceIocContainer_1 = require("./dataScienceIocContainer");
// tslint:disable:no-any no-multiline-string max-func-body-length no-console
suite('Jupyter notebook tests', () => {
    const disposables = [];
    let jupyterExecution;
    let jupyterServer;
    let ioc;
    setup(() => {
        ioc = new dataScienceIocContainer_1.DataScienceIocContainer();
        ioc.registerDataScienceTypes();
        jupyterServer = ioc.serviceManager.get(types_2.INotebookServer);
        jupyterExecution = ioc.serviceManager.get(types_2.IJupyterExecution);
    });
    teardown(() => {
        disposables.forEach(disposable => {
            if (disposable) {
                disposable.dispose();
            }
        });
        jupyterServer.dispose();
        ioc.dispose();
    });
    function escapePath(p) {
        return p.replace(/\\/g, '\\\\');
    }
    function srcDirectory() {
        return path.join(constants_1.EXTENSION_ROOT_DIR, 'src', 'test', 'datascience');
    }
    function assertThrows(func, message) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield func();
                assert.fail(message);
                // tslint:disable-next-line:no-empty
            }
            catch (_a) {
            }
        });
    }
    function verifySimple(code, expectedValue) {
        return __awaiter(this, void 0, void 0, function* () {
            const cells = yield jupyterServer.execute(code, path.join(srcDirectory(), 'foo.py'), 2);
            assert.equal(cells.length, 1, `Wrong number of cells returned`);
            assert.equal(cells[0].data.cell_type, 'code', `Wrong type of cell returned`);
            const cell = cells[0].data;
            assert.equal(cell.outputs.length, 1, `Cell length not correct`);
            const data = cell.outputs[0].data;
            const error = cell.outputs[0].evalue;
            if (error) {
                assert.fail(`Unexpected error: ${error}`);
            }
            assert.ok(data, `No data object on the cell`);
            if (data) { // For linter
                assert.ok(data.hasOwnProperty('text/plain'), `Cell mime type not correct`);
                assert.ok(data['text/plain'], `Cell mime type not correct`);
                assert.equal(data['text/plain'], expectedValue, 'Cell value does not match');
            }
        });
    }
    function verifyError(code, errorString) {
        return __awaiter(this, void 0, void 0, function* () {
            const cells = yield jupyterServer.execute(code, path.join(srcDirectory(), 'foo.py'), 2);
            assert.equal(cells.length, 1, `Wrong number of cells returned`);
            assert.equal(cells[0].data.cell_type, 'code', `Wrong type of cell returned`);
            const cell = cells[0].data;
            assert.equal(cell.outputs.length, 1, `Cell length not correct`);
            const error = cell.outputs[0].evalue;
            if (error) {
                assert.ok(error, 'Error not found when expected');
                assert.equal(error, errorString, 'Unexpected error found');
            }
        });
    }
    function verifyCell(index, code, mimeType, cellType, verifyValue) {
        return __awaiter(this, void 0, void 0, function* () {
            // Verify results of an execute
            const cells = yield jupyterServer.execute(code, path.join(srcDirectory(), 'foo.py'), 2);
            assert.equal(cells.length, 1, `${index}: Wrong number of cells returned`);
            if (cellType === 'code') {
                assert.equal(cells[0].data.cell_type, cellType, `${index}: Wrong type of cell returned`);
                const cell = cells[0].data;
                assert.equal(cell.outputs.length, 1, `${index}: Cell length not correct`);
                const error = cell.outputs[0].evalue;
                if (error) {
                    assert.fail(`${index}: Unexpected error: ${error}`);
                }
                const data = cell.outputs[0].data;
                assert.ok(data, `${index}: No data object on the cell`);
                if (data) { // For linter
                    assert.ok(data.hasOwnProperty(mimeType), `${index}: Cell mime type not correct`);
                    assert.ok(data[mimeType], `${index}: Cell mime type not correct`);
                    verifyValue(data[mimeType]);
                }
            }
            else if (cellType === 'markdown') {
                assert.equal(cells[0].data.cell_type, cellType, `${index}: Wrong type of cell returned`);
                const cell = cells[0].data;
                const outputSource = cell_1.Cell.concatMultilineString(cell.source);
                verifyValue(outputSource);
            }
            else if (cellType === 'error') {
                const cell = cells[0].data;
                assert.equal(cell.outputs.length, 1, `${index}: Cell length not correct`);
                const error = cell.outputs[0].evalue;
                assert.ok(error, 'Error not found when expected');
                verifyValue(error);
            }
        });
    }
    function testMimeTypes(types) {
        runTest('MimeTypes', () => __awaiter(this, void 0, void 0, function* () {
            // Test all mime types together so we don't have to startup and shutdown between
            // each
            const server = yield jupyterServer.start();
            if (!server) {
                assert.fail('Server not created');
            }
            let statusCount = 0;
            jupyterServer.onStatusChanged((bool) => {
                statusCount += 1;
            });
            for (let i = 0; i < types.length; i += 1) {
                const prevCount = statusCount;
                yield verifyCell(i, types[i].code, types[i].mimeType, types[i].cellType, types[i].verifyValue);
                if (types[i].cellType !== 'markdown') {
                    assert.ok(statusCount > prevCount, 'Status didnt update');
                }
            }
        }));
    }
    function runTest(name, func) {
        test(name, () => __awaiter(this, void 0, void 0, function* () {
            if (yield jupyterExecution.isNotebookSupported()) {
                return func();
            }
            else {
                // tslint:disable-next-line:no-console
                console.log(`Skipping test ${name}, no jupyter installed.`);
            }
        }));
    }
    runTest('Creation', () => __awaiter(this, void 0, void 0, function* () {
        const server = yield jupyterServer.start();
        if (!server) {
            assert.fail('Server not created');
        }
    }));
    runTest('Failure', () => __awaiter(this, void 0, void 0, function* () {
        jupyterServer.shutdown().ignoreErrors();
        // Make a dummy class that will fail during launch
        class FailedProcess extends jupyterProcess_1.JupyterProcess {
            waitForConnectionInformation() {
                return Promise.reject('Failing');
            }
        }
        ioc.serviceManager.rebind(types_2.INotebookProcess, FailedProcess);
        jupyterServer = ioc.serviceManager.get(types_2.INotebookServer);
        return assertThrows(() => __awaiter(this, void 0, void 0, function* () {
            yield jupyterServer.start();
        }), 'Server start is not throwing');
    }));
    test('Not installed', () => __awaiter(this, void 0, void 0, function* () {
        jupyterServer.shutdown().ignoreErrors();
        // Make a dummy class that will fail during launch
        class FailedAvailability extends jupyterExecution_1.JupyterExecution {
            constructor() {
                super(...arguments);
                this.isNotebookSupported = () => {
                    return Promise.resolve(false);
                };
            }
        }
        ioc.serviceManager.rebind(types_2.IJupyterExecution, FailedAvailability);
        jupyterServer = ioc.serviceManager.get(types_2.INotebookServer);
        return assertThrows(() => __awaiter(this, void 0, void 0, function* () {
            yield jupyterServer.start();
        }), 'Server start is not throwing');
    }));
    runTest('Export/Import', () => __awaiter(this, void 0, void 0, function* () {
        const server = yield jupyterServer.start();
        if (!server) {
            assert.fail('Server not created');
        }
        // Get a bunch of test cells (use our test cells from the react controls)
        const testState = mainPanelState_1.generateTestState(id => { return; });
        const cells = testState.cellVMs.map((cellVM, index) => { return cellVM.cell; });
        // Translate this into a notebook
        const notebook = yield jupyterServer.translateToNotebook(cells);
        // Save to a temp file
        const fileSystem = ioc.serviceManager.get(types_1.IFileSystem);
        const importer = ioc.serviceManager.get(types_2.INotebookImporter);
        const temp = yield fileSystem.createTemporaryFile('.ipynb');
        try {
            yield fs.writeFile(temp.filePath, JSON.stringify(notebook), 'utf8');
            // Try importing this. This should verify export works and that importing is possible
            yield importer.importFromFile(temp.filePath);
        }
        finally {
            importer.dispose();
            temp.dispose();
        }
    }));
    runTest('Restart kernel', () => __awaiter(this, void 0, void 0, function* () {
        const server = yield jupyterServer.start();
        if (!server) {
            assert.fail('Server not created');
        }
        // Setup some state and verify output is correct
        yield verifySimple('a=1\r\na', 1);
        yield verifySimple('a+=1\r\na', 2);
        yield verifySimple('a+=4\r\na', 6);
        console.log('Waiting for idle');
        // In unit tests we have to wait for status idle before restarting. Unit tests
        // seem to be timing out if the restart throws any exceptions (even if they're caught)
        yield jupyterServer.waitForIdle();
        console.log('Restarting kernel');
        yield jupyterServer.restartKernel();
        console.log('Waiting for idle');
        yield jupyterServer.waitForIdle();
        console.log('Verifying restart');
        yield verifyError('a', `name 'a' is not defined`);
    }));
    testMimeTypes([
        {
            code: `a=1
a`,
            mimeType: 'text/plain',
            cellType: 'code',
            verifyValue: (d) => assert.equal(d, 1, 'Plain text invalid')
        },
        {
            code: `df = pd.read_csv("${escapePath(path.join(srcDirectory(), 'DefaultSalesReport.csv'))}")
df.head()`,
            mimeType: 'text/html',
            cellType: 'code',
            verifyValue: (d) => assert.ok(d.toString().includes('</td>'), 'Table not found')
        },
        {
            code: `df = pd.read("${escapePath(path.join(srcDirectory(), 'DefaultSalesReport.csv'))}")
df.head()`,
            mimeType: 'text/html',
            cellType: 'error',
            verifyValue: (d) => assert.equal(d, `module 'pandas' has no attribute 'read'`, 'Unexpected error result')
        },
        {
            code: `#%% [markdown]#
# #HEADER`,
            mimeType: 'text/plain',
            cellType: 'markdown',
            verifyValue: (d) => assert.equal(d, '#HEADER', 'Markdown incorrect')
        },
        {
            // Test relative directories too.
            code: `df = pd.read_csv("./DefaultSalesReport.csv")
df.head()`,
            mimeType: 'text/html',
            cellType: 'code',
            verifyValue: (d) => assert.ok(d.toString().includes('</td>'), 'Table not found')
        },
        {
            // Plotly
            code: `import matplotlib.pyplot as plt
import matplotlib as mpl
import numpy as np
import pandas as pd
x = np.linspace(0, 20, 100)
plt.plot(x, np.sin(x))
plt.show()`,
            mimeType: 'image/png',
            cellType: 'code',
            verifyValue: (d) => { return; }
        }
    ]);
    // Tests that should be running:
    // - Creation
    // - Failure
    // - Not installed
    // - Different mime types
    // - Export/import
    // - Auto import
    // - changing directories
    // - Restart
    // - Error types
});
//# sourceMappingURL=notebook.functional.test.js.map