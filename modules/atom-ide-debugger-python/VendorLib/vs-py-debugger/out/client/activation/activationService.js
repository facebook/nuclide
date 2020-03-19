// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("inversify");
const types_1 = require("../common/application/types");
const constants_1 = require("../common/constants");
require("../common/extensions");
const types_2 = require("../common/platform/types");
const types_3 = require("../common/types");
const platform_1 = require("../common/utils/platform");
const types_4 = require("../ioc/types");
const telemetry_1 = require("../telemetry");
const constants_2 = require("../telemetry/constants");
const types_5 = require("./types");
const jediEnabledSetting = 'jediEnabled';
const LS_MIN_OS_VERSIONS = [
    // See: https://code.visualstudio.com/docs/supporting/requirements
    [platform_1.OSType.OSX, platform_1.OSDistro.Unknown, '10.12'],
    [platform_1.OSType.Windows, platform_1.OSDistro.Unknown, '6.1'],
    // tslint:disable-next-line: no-suspicious-comment
    // TODO: Are these right?
    [platform_1.OSType.Linux, platform_1.OSDistro.Ubuntu, '14.04'],
    [platform_1.OSType.Linux, platform_1.OSDistro.Debian, '7'],
    [platform_1.OSType.Linux, platform_1.OSDistro.RHEL, '7'],
    [platform_1.OSType.Linux, platform_1.OSDistro.CentOS, '7'],
    [platform_1.OSType.Linux, platform_1.OSDistro.Fedora, '23']
];
let ExtensionActivationService = class ExtensionActivationService {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
        this.workspaceService = this.serviceContainer.get(types_1.IWorkspaceService);
        this.output = this.serviceContainer.get(types_3.IOutputChannel, constants_1.STANDARD_OUTPUT_CHANNEL);
        this.appShell = this.serviceContainer.get(types_1.IApplicationShell);
        const disposables = serviceContainer.get(types_3.IDisposableRegistry);
        disposables.push(this);
        disposables.push(this.workspaceService.onDidChangeConfiguration(this.onDidChangeConfiguration.bind(this)));
    }
    activate() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.currentActivator) {
                return;
            }
            let jedi = this.useJedi();
            if (!jedi && !isLSSupported(this.serviceContainer)) {
                this.appShell.showWarningMessage('The Python Language Server is not supported on your platform.');
                // tslint:disable-next-line:no-suspicious-comment
                // TODO: Only send once (ever)?
                telemetry_1.sendTelemetryEvent(constants_2.PYTHON_LANGUAGE_SERVER_PLATFORM_NOT_SUPPORTED);
                jedi = true;
            }
            yield this.logStartup(jedi);
            const activatorName = jedi ? types_5.ExtensionActivators.Jedi : types_5.ExtensionActivators.DotNet;
            const activator = this.serviceContainer.get(types_5.IExtensionActivator, activatorName);
            this.currentActivator = { jedi, activator };
            yield activator.activate();
        });
    }
    dispose() {
        if (this.currentActivator) {
            this.currentActivator.activator.deactivate().ignoreErrors();
        }
    }
    logStartup(isJedi) {
        return __awaiter(this, void 0, void 0, function* () {
            const outputLine = isJedi ? 'Starting Jedi Python language engine.' : 'Starting Microsoft Python language server.';
            this.output.appendLine(outputLine);
        });
    }
    onDidChangeConfiguration(event) {
        return __awaiter(this, void 0, void 0, function* () {
            const workspacesUris = this.workspaceService.hasWorkspaceFolders ? this.workspaceService.workspaceFolders.map(workspace => workspace.uri) : [undefined];
            if (workspacesUris.findIndex(uri => event.affectsConfiguration(`python.${jediEnabledSetting}`, uri)) === -1) {
                return;
            }
            const jedi = this.useJedi();
            if (this.currentActivator && this.currentActivator.jedi === jedi) {
                return;
            }
            const item = yield this.appShell.showInformationMessage('Please reload the window switching between language engines.', 'Reload');
            if (item === 'Reload') {
                this.serviceContainer.get(types_1.ICommandManager).executeCommand('workbench.action.reloadWindow');
            }
        });
    }
    useJedi() {
        if (constants_1.isLanguageServerTest()) {
            return false;
        }
        const workspacesUris = this.workspaceService.hasWorkspaceFolders ? this.workspaceService.workspaceFolders.map(item => item.uri) : [undefined];
        const configuraionService = this.serviceContainer.get(types_3.IConfigurationService);
        return workspacesUris.filter(uri => configuraionService.getSettings(uri).jediEnabled).length > 0;
    }
};
ExtensionActivationService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_4.IServiceContainer))
], ExtensionActivationService);
exports.ExtensionActivationService = ExtensionActivationService;
function isLSSupported(services) {
    const platform = services.get(types_2.IPlatformService);
    let minVer = '';
    for (const [osType, distro, ver] of LS_MIN_OS_VERSIONS) {
        if (platform.info.type === osType && platform.info.distro === distro) {
            minVer = ver;
            break;
        }
    }
    if (minVer === '') {
        return true;
    }
    minVer = normalizeVersion(minVer);
    return platform.info.version.compare(minVer) >= 0;
}
function normalizeVersion(ver) {
    ver = ver.replace(/\.00*/, '.');
    if (/^\d\d*$/.test(ver)) {
        return `${ver}.0.0`;
    }
    else if (/^\d\d*\.\d\d*$/.test(ver)) {
        return `${ver}.0`;
    }
    else {
        return ver;
    }
}
//# sourceMappingURL=activationService.js.map