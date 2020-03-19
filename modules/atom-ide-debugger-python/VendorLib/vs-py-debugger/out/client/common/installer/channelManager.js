"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
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
const contracts_1 = require("../../interpreter/contracts");
const types_1 = require("../../ioc/types");
const types_2 = require("../application/types");
const types_3 = require("../platform/types");
const productNames_1 = require("./productNames");
const types_4 = require("./types");
let InstallationChannelManager = class InstallationChannelManager {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
    }
    getInstallationChannel(product, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const channels = yield this.getInstallationChannels(resource);
            if (channels.length === 1) {
                return channels[0];
            }
            const productName = productNames_1.ProductNames.get(product);
            const appShell = this.serviceContainer.get(types_2.IApplicationShell);
            if (channels.length === 0) {
                yield this.showNoInstallersMessage(resource);
                return;
            }
            const placeHolder = `Select an option to install ${productName}`;
            const options = channels.map(installer => {
                return {
                    label: `Install using ${installer.displayName}`,
                    description: '',
                    installer
                };
            });
            const selection = yield appShell.showQuickPick(options, { matchOnDescription: true, matchOnDetail: true, placeHolder });
            return selection ? selection.installer : undefined;
        });
    }
    getInstallationChannels(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const installers = this.serviceContainer.getAll(types_4.IModuleInstaller);
            const supportedInstallers = [];
            if (installers.length === 0) {
                return [];
            }
            // group by priority and pick supported from the highest priority
            installers.sort((a, b) => b.priority - a.priority);
            let currentPri = installers[0].priority;
            for (const mi of installers) {
                if (mi.priority !== currentPri) {
                    if (supportedInstallers.length > 0) {
                        break; // return highest priority supported installers
                    }
                    // If none supported, try next priority group
                    currentPri = mi.priority;
                }
                if (yield mi.isSupported(resource)) {
                    supportedInstallers.push(mi);
                }
            }
            return supportedInstallers;
        });
    }
    showNoInstallersMessage(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const interpreters = this.serviceContainer.get(contracts_1.IInterpreterService);
            const interpreter = yield interpreters.getActiveInterpreter(resource);
            if (!interpreter) {
                return; // Handled in the Python installation check.
            }
            const appShell = this.serviceContainer.get(types_2.IApplicationShell);
            const search = 'Search for help';
            let result;
            if (interpreter.type === contracts_1.InterpreterType.Conda) {
                result = yield appShell.showErrorMessage('There is no Conda or Pip installer available in the selected environment.', search);
            }
            else {
                result = yield appShell.showErrorMessage('There is no Pip installer available in the selected environment.', search);
            }
            if (result === search) {
                const platform = this.serviceContainer.get(types_3.IPlatformService);
                const osName = platform.isWindows
                    ? 'Windows'
                    : (platform.isMac ? 'MacOS' : 'Linux');
                appShell.openUrl(`https://www.bing.com/search?q=Install Pip ${osName} ${(interpreter.type === contracts_1.InterpreterType.Conda) ? 'Conda' : ''}`);
            }
        });
    }
};
InstallationChannelManager = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IServiceContainer))
], InstallationChannelManager);
exports.InstallationChannelManager = InstallationChannelManager;
//# sourceMappingURL=channelManager.js.map