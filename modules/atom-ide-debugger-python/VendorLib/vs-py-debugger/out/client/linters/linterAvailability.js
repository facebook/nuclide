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
const logger_1 = require("../common/logger");
const types_2 = require("../common/types");
let AvailableLinterActivator = class AvailableLinterActivator {
    constructor(appShell, installer, workspaceConfig, configService) {
        this.appShell = appShell;
        this.installer = installer;
        this.workspaceConfig = workspaceConfig;
        this.configService = configService;
    }
    /**
     * Check if it is possible to enable an otherwise-unconfigured linter in
     * the current workspace, and if so ask the user if they want that linter
     * configured explicitly.
     *
     * @param linterInfo The linter to check installation status.
     * @param resource Context for the operation (required when in multi-root workspaces).
     *
     * @returns true if configuration was updated in any way, false otherwise.
     */
    promptIfLinterAvailable(linterInfo, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            // Has the feature been enabled yet?
            if (!this.isFeatureEnabled) {
                return false;
            }
            // Has the linter in question has been configured explicitly? If so, no need to continue.
            if (!this.isLinterUsingDefaultConfiguration(linterInfo, resource)) {
                return false;
            }
            // Is the linter available in the current workspace?
            if (yield this.isLinterAvailable(linterInfo.product, resource)) {
                // great, it is - ask the user if they'd like to enable it.
                return this.promptToConfigureAvailableLinter(linterInfo);
            }
            return false;
        });
    }
    /**
     * Raise a dialog asking the user if they would like to explicitly configure a
     * linter or not in their current workspace.
     *
     * @param linterInfo The linter to ask the user to enable or not.
     *
     * @returns true if the user requested a configuration change, false otherwise.
     */
    promptToConfigureAvailableLinter(linterInfo) {
        return __awaiter(this, void 0, void 0, function* () {
            const optButtons = [
                {
                    title: `Enable ${linterInfo.id}`,
                    enabled: true
                },
                {
                    title: `Disable ${linterInfo.id}`,
                    enabled: false
                }
            ];
            // tslint:disable-next-line:messages-must-be-localized
            const pick = yield this.appShell.showInformationMessage(`Linter ${linterInfo.id} is available but not enabled.`, ...optButtons);
            if (pick) {
                yield linterInfo.enableAsync(pick.enabled);
                return true;
            }
            return false;
        });
    }
    /**
     * Check if the linter itself is available in the workspace's Python environment or
     * not.
     *
     * @param linterProduct Linter to check in the current workspace environment.
     * @param resource Context information for workspace.
     */
    isLinterAvailable(linterProduct, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.installer.isInstalled(linterProduct, resource)
                .catch((reason) => {
                // report and continue, assume the linter is unavailable.
                logger_1.traceError(`[WARNING]: Failed to discover if linter ${linterProduct} is installed.`, reason);
                return false;
            });
        });
    }
    /**
     * Check if the given linter has been configured by the user in this workspace or not.
     *
     * @param linterInfo Linter to check for configuration status.
     * @param resource Context information.
     *
     * @returns true if the linter has not been configured at the user, workspace, or workspace-folder scope. false otherwise.
     */
    isLinterUsingDefaultConfiguration(linterInfo, resource) {
        const ws = this.workspaceConfig.getConfiguration('python.linting', resource);
        const pe = ws.inspect(linterInfo.enabledSettingName);
        return (pe.globalValue === undefined && pe.workspaceValue === undefined && pe.workspaceFolderValue === undefined);
    }
    /**
     * Check if this feature is enabled yet.
     *
     * This is a feature of the vscode-python extension that will become enabled once the
     * Python Language Server becomes the default, replacing Jedi as the default. Testing
     * the global default setting for `"python.jediEnabled": false` enables it.
     *
     * @returns true if the global default for python.jediEnabled is false.
     */
    get isFeatureEnabled() {
        return !this.configService.getSettings().jediEnabled;
    }
};
AvailableLinterActivator = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IApplicationShell)),
    __param(1, inversify_1.inject(types_2.IInstaller)),
    __param(2, inversify_1.inject(types_1.IWorkspaceService)),
    __param(3, inversify_1.inject(types_2.IConfigurationService))
], AvailableLinterActivator);
exports.AvailableLinterActivator = AvailableLinterActivator;
//# sourceMappingURL=linterAvailability.js.map