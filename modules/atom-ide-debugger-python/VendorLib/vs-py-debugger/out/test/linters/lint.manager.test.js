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
const typeMoq = require("typemoq");
const service_1 = require("../../client/common/configuration/service");
const types_1 = require("../../client/common/types");
const EnumEx = require("../../client/common/utils/enum");
const container_1 = require("../../client/ioc/container");
const serviceManager_1 = require("../../client/ioc/serviceManager");
const types_2 = require("../../client/ioc/types");
const linterManager_1 = require("../../client/linters/linterManager");
const initialize_1 = require("../initialize");
// tslint:disable-next-line:max-func-body-length
suite('Linting - Manager', () => {
    let lm;
    let configService;
    let settings;
    suiteSetup(initialize_1.initialize);
    setup(() => __awaiter(this, void 0, void 0, function* () {
        const cont = new inversify_1.Container();
        const serviceManager = new serviceManager_1.ServiceManager(cont);
        const serviceContainer = new container_1.ServiceContainer(cont);
        serviceManager.addSingletonInstance(types_2.IServiceContainer, serviceContainer);
        serviceManager.addSingleton(types_1.IConfigurationService, service_1.ConfigurationService);
        configService = serviceManager.get(types_1.IConfigurationService);
        settings = configService.getSettings();
        const workspaceService = typeMoq.Mock.ofType();
        lm = new linterManager_1.LinterManager(serviceContainer, workspaceService.object);
        yield lm.setActiveLintersAsync([types_1.Product.pylint]);
        yield lm.enableLintingAsync(true);
    }));
    test('Ensure product is set in Execution Info', () => __awaiter(this, void 0, void 0, function* () {
        [types_1.Product.bandit, types_1.Product.flake8, types_1.Product.mypy, types_1.Product.pep8,
            types_1.Product.pydocstyle, types_1.Product.pylama, types_1.Product.pylint].forEach(product => {
            const execInfo = lm.getLinterInfo(product).getExecutionInfo([]);
            assert.equal(execInfo.product, product, `Incorrect information for ${product}`);
        });
    }));
    test('Ensure executable is set in Execution Info', () => __awaiter(this, void 0, void 0, function* () {
        [types_1.Product.bandit, types_1.Product.flake8, types_1.Product.mypy, types_1.Product.pep8,
            types_1.Product.pydocstyle, types_1.Product.pylama, types_1.Product.pylint].forEach(product => {
            const info = lm.getLinterInfo(product);
            const execInfo = info.getExecutionInfo([]);
            const execPath = settings.linting[info.pathSettingName];
            assert.equal(execInfo.execPath, execPath, `Incorrect executable paths for product ${info.id}`);
        });
    }));
    test('Ensure correct setting names are returned', () => __awaiter(this, void 0, void 0, function* () {
        [types_1.Product.bandit, types_1.Product.flake8, types_1.Product.mypy, types_1.Product.pep8,
            types_1.Product.pydocstyle, types_1.Product.pylama, types_1.Product.pylint].forEach(product => {
            const linter = lm.getLinterInfo(product);
            const expected = {
                argsName: `${linter.id}Args`,
                pathName: `${linter.id}Path`,
                enabledName: `${linter.id}Enabled`
            };
            assert.equal(linter.argsSettingName, expected.argsName, `Incorrect args settings for product ${linter.id}`);
            assert.equal(linter.pathSettingName, expected.pathName, `Incorrect path settings for product ${linter.id}`);
            assert.equal(linter.enabledSettingName, expected.enabledName, `Incorrect enabled settings for product ${linter.id}`);
        });
    }));
    test('Ensure linter id match product', () => __awaiter(this, void 0, void 0, function* () {
        const ids = ['bandit', 'flake8', 'mypy', 'pep8', 'prospector', 'pydocstyle', 'pylama', 'pylint'];
        const products = [types_1.Product.bandit, types_1.Product.flake8, types_1.Product.mypy, types_1.Product.pep8, types_1.Product.prospector, types_1.Product.pydocstyle, types_1.Product.pylama, types_1.Product.pylint];
        for (let i = 0; i < products.length; i += 1) {
            const linter = lm.getLinterInfo(products[i]);
            assert.equal(linter.id, ids[i], `Id ${ids[i]} does not match product ${products[i]}`);
        }
    }));
    test('Enable/disable linting', () => __awaiter(this, void 0, void 0, function* () {
        yield lm.enableLintingAsync(false);
        assert.equal(yield lm.isLintingEnabled(true), false, 'Linting not disabled');
        yield lm.enableLintingAsync(true);
        assert.equal(yield lm.isLintingEnabled(true), true, 'Linting not enabled');
    }));
    test('Set single linter', () => __awaiter(this, void 0, void 0, function* () {
        for (const linter of lm.getAllLinterInfos()) {
            yield lm.setActiveLintersAsync([linter.product]);
            const selected = yield lm.getActiveLinters(true);
            assert.notEqual(selected.length, 0, 'Current linter is undefined');
            assert.equal(linter.id, selected[0].id, `Selected linter ${selected} does not match requested ${linter.id}`);
        }
    }));
    test('Set multiple linters', () => __awaiter(this, void 0, void 0, function* () {
        yield lm.setActiveLintersAsync([types_1.Product.flake8, types_1.Product.pydocstyle]);
        const selected = yield lm.getActiveLinters(true);
        assert.equal(selected.length, 2, 'Selected linters lengths does not match');
        assert.equal(types_1.Product.flake8, selected[0].product, `Selected linter ${selected[0].id} does not match requested 'flake8'`);
        assert.equal(types_1.Product.pydocstyle, selected[1].product, `Selected linter ${selected[1].id} does not match requested 'pydocstyle'`);
    }));
    test('Try setting unsupported linter', () => __awaiter(this, void 0, void 0, function* () {
        const before = yield lm.getActiveLinters(true);
        assert.notEqual(before, undefined, 'Current/before linter is undefined');
        yield lm.setActiveLintersAsync([types_1.Product.nosetest]);
        const after = yield lm.getActiveLinters(true);
        assert.notEqual(after, undefined, 'Current/after linter is undefined');
        assert.equal(after[0].id, before[0].id, 'Should not be able to set unsupported linter');
    }));
    test('Pylint configuration file watch', () => __awaiter(this, void 0, void 0, function* () {
        const pylint = lm.getLinterInfo(types_1.Product.pylint);
        assert.equal(pylint.configFileNames.length, 2, 'Pylint configuration file count is incorrect.');
        assert.notEqual(pylint.configFileNames.indexOf('pylintrc'), -1, 'Pylint configuration files miss pylintrc.');
        assert.notEqual(pylint.configFileNames.indexOf('.pylintrc'), -1, 'Pylint configuration files miss .pylintrc.');
    }));
    EnumEx.getValues(types_1.Product).forEach(product => {
        const linterIdMapping = new Map();
        linterIdMapping.set(types_1.Product.bandit, 'bandit');
        linterIdMapping.set(types_1.Product.flake8, 'flake8');
        linterIdMapping.set(types_1.Product.mypy, 'mypy');
        linterIdMapping.set(types_1.Product.pep8, 'pep8');
        linterIdMapping.set(types_1.Product.prospector, 'prospector');
        linterIdMapping.set(types_1.Product.pydocstyle, 'pydocstyle');
        linterIdMapping.set(types_1.Product.pylama, 'pylama');
        linterIdMapping.set(types_1.Product.pylint, 'pylint');
        if (linterIdMapping.has(product)) {
            return;
        }
        test(`Ensure translation of ids throws exceptions for unknown linters (${product})`, () => __awaiter(this, void 0, void 0, function* () {
            assert.throws(() => lm.getLinterInfo(product));
        }));
    });
});
//# sourceMappingURL=lint.manager.test.js.map