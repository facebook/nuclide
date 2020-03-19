// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:max-func-body-length no-any
const chai_1 = require("chai");
const TypeMoq = require("typemoq");
const featureDeprecationManager_1 = require("../../client/common/featureDeprecationManager");
suite('Feature Deprecation Manager Tests', () => {
    test('Ensure deprecated command Build_Workspace_Symbols registers its popup', () => {
        const persistentState = TypeMoq.Mock.ofType();
        const persistentBool = TypeMoq.Mock.ofType();
        persistentBool.setup(a => a.value).returns(() => true);
        persistentBool.setup(a => a.updateValue(TypeMoq.It.isValue(false)))
            .returns(() => Promise.resolve());
        persistentState.setup(a => a.createGlobalPersistentState(TypeMoq.It.isValue('SHOW_DEPRECATED_FEATURE_PROMPT_BUILD_WORKSPACE_SYMBOLS'), TypeMoq.It.isValue(true)))
            .returns(() => persistentBool.object)
            .verifiable(TypeMoq.Times.once());
        const popupMgr = TypeMoq.Mock.ofType();
        popupMgr.setup(p => p.showInformationMessage(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString()))
            .returns((val) => new Promise((resolve, reject) => { resolve('Learn More'); }));
        const cmdDisposable = TypeMoq.Mock.ofType();
        const cmdManager = TypeMoq.Mock.ofType();
        cmdManager.setup(c => c.registerCommand(TypeMoq.It.isValue('python.buildWorkspaceSymbols'), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => cmdDisposable.object)
            .verifiable(TypeMoq.Times.atLeastOnce());
        const workspaceConfig = TypeMoq.Mock.ofType();
        workspaceConfig.setup(ws => ws.has(TypeMoq.It.isAnyString()))
            .returns(() => false)
            .verifiable(TypeMoq.Times.atLeastOnce());
        const workspace = TypeMoq.Mock.ofType();
        workspace.setup(w => w.getConfiguration(TypeMoq.It.isValue('python'), TypeMoq.It.isAny()))
            .returns(() => workspaceConfig.object);
        const featureDepMgr = new featureDeprecationManager_1.FeatureDeprecationManager(persistentState.object, cmdManager.object, workspace.object, popupMgr.object);
        featureDepMgr.initialize();
    });
    test('Ensure setting is checked', () => {
        const pythonConfig = TypeMoq.Mock.ofType();
        const deprecatedSetting = { setting: 'autoComplete.preloadModules' };
        // tslint:disable-next-line:no-any
        const _ = {};
        const featureDepMgr = new featureDeprecationManager_1.FeatureDeprecationManager(_, _, _, _);
        pythonConfig
            .setup(p => p.has(TypeMoq.It.isValue(deprecatedSetting.setting)))
            .returns(() => false)
            .verifiable(TypeMoq.Times.atLeastOnce());
        let isUsed = featureDepMgr.isDeprecatedSettingAndValueUsed(pythonConfig.object, deprecatedSetting);
        pythonConfig.verifyAll();
        chai_1.expect(isUsed).to.be.equal(false, 'Setting should not be used');
        let testConfigs = [
            { valueInSetting: [], expectedValue: false },
            { valueInSetting: ['1'], expectedValue: true },
            { valueInSetting: [1], expectedValue: true },
            { valueInSetting: [{}], expectedValue: true }
        ];
        for (const config of testConfigs) {
            pythonConfig.reset();
            pythonConfig
                .setup(p => p.has(TypeMoq.It.isValue(deprecatedSetting.setting)))
                .returns(() => true)
                .verifiable(TypeMoq.Times.atLeastOnce());
            pythonConfig
                .setup(p => p.get(TypeMoq.It.isValue(deprecatedSetting.setting)))
                .returns(() => config.valueInSetting);
            isUsed = featureDepMgr.isDeprecatedSettingAndValueUsed(pythonConfig.object, deprecatedSetting);
            pythonConfig.verifyAll();
            chai_1.expect(isUsed).to.be.equal(config.expectedValue, `Failed for config = ${JSON.stringify(config)}`);
        }
        testConfigs = [
            { valueInSetting: 'true', expectedValue: true, valuesToLookFor: ['true', true] },
            { valueInSetting: true, expectedValue: true, valuesToLookFor: ['true', true] },
            { valueInSetting: 'false', expectedValue: true, valuesToLookFor: ['false', false] },
            { valueInSetting: false, expectedValue: true, valuesToLookFor: ['false', false] }
        ];
        for (const config of testConfigs) {
            pythonConfig.reset();
            pythonConfig
                .setup(p => p.has(TypeMoq.It.isValue(deprecatedSetting.setting)))
                .returns(() => true)
                .verifiable(TypeMoq.Times.atLeastOnce());
            pythonConfig
                .setup(p => p.get(TypeMoq.It.isValue(deprecatedSetting.setting)))
                .returns(() => config.valueInSetting);
            deprecatedSetting.values = config.valuesToLookFor;
            isUsed = featureDepMgr.isDeprecatedSettingAndValueUsed(pythonConfig.object, deprecatedSetting);
            pythonConfig.verifyAll();
            chai_1.expect(isUsed).to.be.equal(config.expectedValue, `Failed for config = ${JSON.stringify(config)}`);
        }
    });
});
//# sourceMappingURL=featureDeprecationManager.unit.test.js.map