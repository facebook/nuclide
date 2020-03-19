"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const types_1 = require("../../common/platform/types");
const types_2 = require("../../common/types");
const testConfigurationManager_1 = require("../common/managers/testConfigurationManager");
class ConfigurationManager extends testConfigurationManager_1.TestConfigurationManager {
    constructor(workspace, serviceContainer) {
        super(workspace, types_2.Product.nosetest, serviceContainer);
    }
    requiresUserToConfigure(wkspace) {
        return __awaiter(this, void 0, void 0, function* () {
            const fs = this.serviceContainer.get(types_1.IFileSystem);
            for (const cfg of ['.noserc', 'nose.cfg']) {
                if (yield fs.fileExists(path.join(wkspace.fsPath, cfg))) {
                    return true;
                }
            }
            return false;
        });
    }
    configure(wkspace) {
        return __awaiter(this, void 0, void 0, function* () {
            const args = [];
            const configFileOptionLabel = 'Use existing config file';
            // If a config file exits, there's nothing to be configured.
            if (yield this.requiresUserToConfigure(wkspace)) {
                return;
            }
            const subDirs = yield this.getTestDirs(wkspace.fsPath);
            const testDir = yield this.selectTestDir(wkspace.fsPath, subDirs);
            if (typeof testDir === 'string' && testDir !== configFileOptionLabel) {
                args.push(testDir);
            }
            const installed = yield this.installer.isInstalled(types_2.Product.nosetest);
            if (!installed) {
                yield this.installer.install(types_2.Product.nosetest);
            }
            yield this.testConfigSettingsService.updateTestArgs(wkspace.fsPath, types_2.Product.nosetest, args);
        });
    }
}
exports.ConfigurationManager = ConfigurationManager;
//# sourceMappingURL=testConfigurationManager.js.map