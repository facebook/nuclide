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
const inversify_1 = require("inversify");
const TypeMoq = require("typemoq");
const types_1 = require("../../client/common/application/types");
const service_1 = require("../../client/common/configuration/service");
const types_2 = require("../../client/common/types");
const container_1 = require("../../client/ioc/container");
const serviceManager_1 = require("../../client/ioc/serviceManager");
const types_3 = require("../../client/ioc/types");
const linterCommands_1 = require("../../client/linters/linterCommands");
const linterManager_1 = require("../../client/linters/linterManager");
const types_4 = require("../../client/linters/types");
const initialize_1 = require("../initialize");
// tslint:disable-next-line:max-func-body-length
suite('Linting - Linter Selector', () => {
    let serviceContainer;
    let appShell;
    let commands;
    let lm;
    let engine;
    suiteSetup(initialize_1.initialize);
    setup(() => __awaiter(this, void 0, void 0, function* () {
        yield initialize_1.initializeTest();
        initializeServices();
    }));
    suiteTeardown(initialize_1.closeActiveWindows);
    teardown(() => __awaiter(this, void 0, void 0, function* () { return initialize_1.closeActiveWindows(); }));
    function initializeServices() {
        const cont = new inversify_1.Container();
        const serviceManager = new serviceManager_1.ServiceManager(cont);
        serviceContainer = new container_1.ServiceContainer(cont);
        serviceManager.addSingletonInstance(types_3.IServiceContainer, serviceContainer);
        appShell = TypeMoq.Mock.ofType();
        serviceManager.addSingleton(types_2.IConfigurationService, service_1.ConfigurationService);
        const commandManager = TypeMoq.Mock.ofType();
        serviceManager.addSingletonInstance(types_1.ICommandManager, commandManager.object);
        serviceManager.addSingletonInstance(types_1.IApplicationShell, appShell.object);
        engine = TypeMoq.Mock.ofType();
        serviceManager.addSingletonInstance(types_4.ILintingEngine, engine.object);
        const workspaceService = TypeMoq.Mock.ofType();
        lm = new linterManager_1.LinterManager(serviceContainer, workspaceService.object);
        serviceManager.addSingletonInstance(types_4.ILinterManager, lm);
        commands = new linterCommands_1.LinterCommands(serviceContainer);
    }
    test('Enable linting', () => __awaiter(this, void 0, void 0, function* () {
        yield enableDisableLinterAsync(true);
    }));
    test('Disable linting', () => __awaiter(this, void 0, void 0, function* () {
        yield enableDisableLinterAsync(false);
    }));
    test('Single linter active', () => __awaiter(this, void 0, void 0, function* () {
        yield selectLinterAsync([types_2.Product.pylama]);
    }));
    test('Multiple linters active', () => __awaiter(this, void 0, void 0, function* () {
        yield selectLinterAsync([types_2.Product.flake8, types_2.Product.pydocstyle]);
    }));
    test('No linters active', () => __awaiter(this, void 0, void 0, function* () {
        yield selectLinterAsync([types_2.Product.flake8]);
    }));
    test('Run linter command', () => __awaiter(this, void 0, void 0, function* () {
        yield commands.runLinting();
        engine.verify(p => p.lintOpenPythonFiles(), TypeMoq.Times.once());
    }));
    function enableDisableLinterAsync(enable) {
        return __awaiter(this, void 0, void 0, function* () {
            let suggestions = [];
            let options;
            yield lm.enableLintingAsync(!enable);
            appShell.setup(x => x.showQuickPick(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .callback((s, o) => {
                suggestions = s;
                options = o;
            })
                .returns((s) => enable
                ? new Promise((resolve, reject) => { return resolve('on'); })
                : new Promise((resolve, reject) => { return resolve('off'); }));
            const current = enable ? 'off' : 'on';
            yield commands.enableLintingAsync();
            assert.notEqual(suggestions.length, 0, 'showQuickPick was not called');
            assert.notEqual(options, undefined, 'showQuickPick was not called');
            assert.equal(suggestions.length, 2, 'Wrong number of suggestions');
            assert.equal(suggestions[0], 'on', 'Wrong first suggestions');
            assert.equal(suggestions[1], 'off', 'Wrong second suggestions');
            assert.equal(options.matchOnDescription, true, 'Quick pick options are incorrect');
            assert.equal(options.matchOnDetail, true, 'Quick pick options are incorrect');
            assert.equal(options.placeHolder, `current: ${current}`, 'Quick pick current option is incorrect');
            assert.equal(yield lm.isLintingEnabled(true, undefined), enable, 'Linting selector did not change linting on/off flag');
        });
    }
    function selectLinterAsync(products) {
        return __awaiter(this, void 0, void 0, function* () {
            let suggestions = [];
            let options;
            let warning;
            appShell.setup(x => x.showQuickPick(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .callback((s, o) => {
                suggestions = s;
                options = o;
            })
                .returns(s => new Promise((resolve, reject) => resolve('pylint')));
            appShell.setup(x => x.showWarningMessage(TypeMoq.It.isAnyString(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .callback((s, o) => {
                warning = s;
            })
                .returns(s => new Promise((resolve, reject) => resolve('Yes')));
            const linters = lm.getAllLinterInfos();
            yield lm.setActiveLintersAsync(products);
            let current;
            let activeLinters = yield lm.getActiveLinters(true);
            switch (activeLinters.length) {
                case 0:
                    current = 'none';
                    break;
                case 1:
                    current = activeLinters[0].id;
                    break;
                default:
                    current = 'multiple selected';
                    break;
            }
            yield commands.setLinterAsync();
            assert.notEqual(suggestions.length, 0, 'showQuickPick was not called');
            assert.notEqual(options, undefined, 'showQuickPick was not called');
            assert.equal(suggestions.length, linters.length, 'Wrong number of suggestions');
            assert.deepEqual(suggestions, linters.map(x => x.id).sort(), 'Wrong linters order in suggestions');
            assert.equal(options.matchOnDescription, true, 'Quick pick options are incorrect');
            assert.equal(options.matchOnDetail, true, 'Quick pick options are incorrect');
            assert.equal(options.placeHolder, `current: ${current}`, 'Quick pick current option is incorrect');
            activeLinters = yield lm.getActiveLinters(true);
            assert.equal(activeLinters.length, 1, 'Linting selector did not change active linter');
            assert.equal(activeLinters[0].product, types_2.Product.pylint, 'Linting selector did not change to pylint');
            if (products.length > 1) {
                assert.notEqual(warning, undefined, 'Warning was not shown when overwriting multiple linters');
            }
        });
    }
});
//# sourceMappingURL=lint.commands.test.js.map