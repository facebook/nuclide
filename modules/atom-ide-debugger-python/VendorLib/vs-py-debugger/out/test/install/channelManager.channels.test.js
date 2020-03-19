"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
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
const channelManager_1 = require("../../client/common/installer/channelManager");
const types_2 = require("../../client/common/installer/types");
const types_3 = require("../../client/common/types");
const platform_1 = require("../../client/common/utils/platform");
const contracts_1 = require("../../client/interpreter/contracts");
const container_1 = require("../../client/ioc/container");
const serviceManager_1 = require("../../client/ioc/serviceManager");
const info = {
    architecture: platform_1.Architecture.Unknown,
    companyDisplayName: '',
    displayName: '',
    envName: '',
    path: '',
    type: contracts_1.InterpreterType.Unknown,
    version: '',
    version_info: [0, 0, 0, 'alpha'],
    sysPrefix: '',
    sysVersion: ''
};
// tslint:disable-next-line:max-func-body-length
suite('Installation - installation channels', () => {
    let serviceManager;
    let serviceContainer;
    let pipEnv;
    setup(() => {
        const cont = new inversify_1.Container();
        serviceManager = new serviceManager_1.ServiceManager(cont);
        serviceContainer = new container_1.ServiceContainer(cont);
        pipEnv = TypeMoq.Mock.ofType();
        serviceManager.addSingletonInstance(contracts_1.IInterpreterLocatorService, pipEnv.object, contracts_1.PIPENV_SERVICE);
    });
    test('Single channel', () => __awaiter(this, void 0, void 0, function* () {
        const installer = mockInstaller(true, '');
        const cm = new channelManager_1.InstallationChannelManager(serviceContainer);
        const channels = yield cm.getInstallationChannels();
        assert.equal(channels.length, 1, 'Incorrect number of channels');
        assert.equal(channels[0], installer.object, 'Incorrect installer');
    }));
    test('Multiple channels', () => __awaiter(this, void 0, void 0, function* () {
        const installer1 = mockInstaller(true, '1');
        mockInstaller(false, '2');
        const installer3 = mockInstaller(true, '3');
        const cm = new channelManager_1.InstallationChannelManager(serviceContainer);
        const channels = yield cm.getInstallationChannels();
        assert.equal(channels.length, 2, 'Incorrect number of channels');
        assert.equal(channels[0], installer1.object, 'Incorrect installer 1');
        assert.equal(channels[1], installer3.object, 'Incorrect installer 2');
    }));
    test('pipenv channel', () => __awaiter(this, void 0, void 0, function* () {
        mockInstaller(true, '1');
        mockInstaller(false, '2');
        mockInstaller(true, '3');
        const pipenvInstaller = mockInstaller(true, 'pipenv', 10);
        const interpreter = Object.assign({}, info, { path: 'pipenv', type: contracts_1.InterpreterType.VirtualEnv });
        pipEnv.setup(x => x.getInterpreters(TypeMoq.It.isAny())).returns(() => Promise.resolve([interpreter]));
        const cm = new channelManager_1.InstallationChannelManager(serviceContainer);
        const channels = yield cm.getInstallationChannels();
        assert.equal(channels.length, 1, 'Incorrect number of channels');
        assert.equal(channels[0], pipenvInstaller.object, 'Installer must be pipenv');
    }));
    test('Select installer', () => __awaiter(this, void 0, void 0, function* () {
        const installer1 = mockInstaller(true, '1');
        const installer2 = mockInstaller(true, '2');
        const appShell = TypeMoq.Mock.ofType();
        serviceManager.addSingletonInstance(types_1.IApplicationShell, appShell.object);
        // tslint:disable-next-line:no-any
        let items;
        appShell
            .setup(x => x.showQuickPick(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .callback((i, o) => {
            items = i;
        })
            .returns(() => new Promise((resolve, reject) => resolve(undefined)));
        installer1.setup(x => x.displayName).returns(() => 'Name 1');
        installer2.setup(x => x.displayName).returns(() => 'Name 2');
        const cm = new channelManager_1.InstallationChannelManager(serviceContainer);
        yield cm.getInstallationChannel(types_3.Product.pylint);
        assert.notEqual(items, undefined, 'showQuickPick not called');
        assert.equal(items.length, 2, 'Incorrect number of installer shown');
        assert.notEqual(items[0].label.indexOf('Name 1'), -1, 'Incorrect first installer name');
        assert.notEqual(items[1].label.indexOf('Name 2'), -1, 'Incorrect second installer name');
    }));
    function mockInstaller(supported, name, priority) {
        const installer = TypeMoq.Mock.ofType();
        installer
            .setup(x => x.isSupported(TypeMoq.It.isAny()))
            .returns(() => new Promise((resolve) => resolve(supported)));
        installer.setup(x => x.priority).returns(() => priority ? priority : 0);
        serviceManager.addSingletonInstance(types_2.IModuleInstaller, installer.object, name);
        return installer;
    }
});
//# sourceMappingURL=channelManager.channels.test.js.map