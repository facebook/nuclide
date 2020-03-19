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
const types_3 = require("../../client/common/platform/types");
const types_4 = require("../../client/common/types");
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
suite('Installation - channel messages', () => {
    let serviceContainer;
    let platform;
    let appShell;
    let interpreters;
    setup(() => {
        const cont = new inversify_1.Container();
        const serviceManager = new serviceManager_1.ServiceManager(cont);
        serviceContainer = new container_1.ServiceContainer(cont);
        platform = TypeMoq.Mock.ofType();
        serviceManager.addSingletonInstance(types_3.IPlatformService, platform.object);
        appShell = TypeMoq.Mock.ofType();
        serviceManager.addSingletonInstance(types_1.IApplicationShell, appShell.object);
        interpreters = TypeMoq.Mock.ofType();
        serviceManager.addSingletonInstance(contracts_1.IInterpreterService, interpreters.object);
        const moduleInstaller = TypeMoq.Mock.ofType();
        serviceManager.addSingletonInstance(types_2.IModuleInstaller, moduleInstaller.object);
    });
    test('No installers message: Unknown/Windows', () => __awaiter(this, void 0, void 0, function* () {
        platform.setup(x => x.isWindows).returns(() => true);
        yield testInstallerMissingMessage(contracts_1.InterpreterType.Unknown, (message, url) => __awaiter(this, void 0, void 0, function* () {
            verifyMessage(message, ['Pip'], ['Conda']);
            verifyUrl(url, ['Windows', 'Pip']);
        }));
    }));
    test('No installers message: Conda/Windows', () => __awaiter(this, void 0, void 0, function* () {
        platform.setup(x => x.isWindows).returns(() => true);
        yield testInstallerMissingMessage(contracts_1.InterpreterType.Conda, (message, url) => __awaiter(this, void 0, void 0, function* () {
            verifyMessage(message, ['Pip', 'Conda'], []);
            verifyUrl(url, ['Windows', 'Pip', 'Conda']);
        }));
    }));
    test('No installers message: Unknown/Mac', () => __awaiter(this, void 0, void 0, function* () {
        platform.setup(x => x.isWindows).returns(() => false);
        platform.setup(x => x.isMac).returns(() => true);
        yield testInstallerMissingMessage(contracts_1.InterpreterType.Unknown, (message, url) => __awaiter(this, void 0, void 0, function* () {
            verifyMessage(message, ['Pip'], ['Conda']);
            verifyUrl(url, ['Mac', 'Pip']);
        }));
    }));
    test('No installers message: Conda/Mac', () => __awaiter(this, void 0, void 0, function* () {
        platform.setup(x => x.isWindows).returns(() => false);
        platform.setup(x => x.isMac).returns(() => true);
        yield testInstallerMissingMessage(contracts_1.InterpreterType.Conda, (message, url) => __awaiter(this, void 0, void 0, function* () {
            verifyMessage(message, ['Pip', 'Conda'], []);
            verifyUrl(url, ['Mac', 'Pip', 'Conda']);
        }));
    }));
    test('No installers message: Unknown/Linux', () => __awaiter(this, void 0, void 0, function* () {
        platform.setup(x => x.isWindows).returns(() => false);
        platform.setup(x => x.isMac).returns(() => false);
        platform.setup(x => x.isLinux).returns(() => true);
        yield testInstallerMissingMessage(contracts_1.InterpreterType.Unknown, (message, url) => __awaiter(this, void 0, void 0, function* () {
            verifyMessage(message, ['Pip'], ['Conda']);
            verifyUrl(url, ['Linux', 'Pip']);
        }));
    }));
    test('No installers message: Conda/Linux', () => __awaiter(this, void 0, void 0, function* () {
        platform.setup(x => x.isWindows).returns(() => false);
        platform.setup(x => x.isMac).returns(() => false);
        platform.setup(x => x.isLinux).returns(() => true);
        yield testInstallerMissingMessage(contracts_1.InterpreterType.Conda, (message, url) => __awaiter(this, void 0, void 0, function* () {
            verifyMessage(message, ['Pip', 'Conda'], []);
            verifyUrl(url, ['Linux', 'Pip', 'Conda']);
        }));
    }));
    test('No channels message', () => __awaiter(this, void 0, void 0, function* () {
        platform.setup(x => x.isWindows).returns(() => true);
        yield testInstallerMissingMessage(contracts_1.InterpreterType.Unknown, (message, url) => __awaiter(this, void 0, void 0, function* () {
            verifyMessage(message, ['Pip'], ['Conda']);
            verifyUrl(url, ['Windows', 'Pip']);
        }), 'getInstallationChannel');
    }));
    function verifyMessage(message, present, missing) {
        for (const p of present) {
            assert.equal(message.indexOf(p) >= 0, true, `Message does not contain ${p}.`);
        }
        for (const m of missing) {
            assert.equal(message.indexOf(m) < 0, true, `Message incorrectly contains ${m}.`);
        }
    }
    function verifyUrl(url, terms) {
        assert.equal(url.indexOf('https://') >= 0, true, 'Search Url must be https.');
        for (const term of terms) {
            assert.equal(url.indexOf(term) >= 0, true, `Search Url does not contain ${term}.`);
        }
    }
    function testInstallerMissingMessage(interpreterType, verify, methodType = 'showNoInstallersMessage') {
        return __awaiter(this, void 0, void 0, function* () {
            const activeInterpreter = Object.assign({}, info, { type: interpreterType, path: '' });
            interpreters
                .setup(x => x.getActiveInterpreter(TypeMoq.It.isAny()))
                .returns(() => new Promise((resolve, reject) => resolve(activeInterpreter)));
            const channels = new channelManager_1.InstallationChannelManager(serviceContainer);
            let url = '';
            let message = '';
            let search = '';
            appShell
                .setup(x => x.showErrorMessage(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString()))
                .callback((m, s) => {
                message = m;
                search = s;
            })
                .returns(() => new Promise((resolve, reject) => resolve(search)));
            appShell.setup(x => x.openUrl(TypeMoq.It.isAnyString())).callback((s) => {
                url = s;
            });
            if (methodType === 'showNoInstallersMessage') {
                yield channels.showNoInstallersMessage();
            }
            else {
                yield channels.getInstallationChannel(types_4.Product.pylint);
            }
            yield verify(message, url);
        });
    }
});
//# sourceMappingURL=channelManager.messages.test.js.map