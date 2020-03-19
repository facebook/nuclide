"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const vscode_1 = require("vscode");
const configSettings_1 = require("../../../client/common/configSettings");
const types_1 = require("../../../client/common/types");
const initialize_1 = require("../../initialize");
const serviceRegistry_1 = require("../../unittests/serviceRegistry");
// tslint:disable-next-line:max-func-body-length
suite('Configuration Service', () => {
    let ioc;
    suiteSetup(initialize_1.initialize);
    setup(() => {
        ioc = new serviceRegistry_1.UnitTestIocContainer();
        ioc.registerCommonTypes();
    });
    teardown(() => ioc.dispose());
    test('Ensure same instance of settings return', () => {
        const workspaceUri = vscode_1.workspace.workspaceFolders[0].uri;
        const settings = ioc.serviceContainer.get(types_1.IConfigurationService).getSettings(workspaceUri);
        const instanceIsSame = settings === configSettings_1.PythonSettings.getInstance(workspaceUri);
        chai_1.expect(instanceIsSame).to.be.equal(true, 'Incorrect settings');
    });
});
//# sourceMappingURL=service.test.js.map