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
        super(workspace, types_2.Product.pytest, serviceContainer);
    }
    requiresUserToConfigure(wkspace) {
        return __awaiter(this, void 0, void 0, function* () {
            const configFiles = yield this.getConfigFiles(wkspace.fsPath);
            // If a config file exits, there's nothing to be configured.
            if (configFiles.length > 0 && configFiles.length !== 1 && configFiles[0] !== 'setup.cfg') {
                return false;
            }
            return true;
        });
    }
    configure(wkspace) {
        return __awaiter(this, void 0, void 0, function* () {
            const args = [];
            const configFileOptionLabel = 'Use existing config file';
            const options = [];
            const configFiles = yield this.getConfigFiles(wkspace.fsPath);
            // If a config file exits, there's nothing to be configured.
            if (configFiles.length > 0 && configFiles.length !== 1 && configFiles[0] !== 'setup.cfg') {
                return;
            }
            if (configFiles.length === 1 && configFiles[0] === 'setup.cfg') {
                options.push({
                    label: configFileOptionLabel,
                    description: 'setup.cfg'
                });
            }
            const subDirs = yield this.getTestDirs(wkspace.fsPath);
            const testDir = yield this.selectTestDir(wkspace.fsPath, subDirs, options);
            if (typeof testDir === 'string' && testDir !== configFileOptionLabel) {
                args.push(testDir);
            }
            const installed = yield this.installer.isInstalled(types_2.Product.pytest);
            if (!installed) {
                yield this.installer.install(types_2.Product.pytest);
            }
            yield this.testConfigSettingsService.updateTestArgs(wkspace.fsPath, types_2.Product.pytest, args);
        });
    }
    getConfigFiles(rootDir) {
        return __awaiter(this, void 0, void 0, function* () {
            const fs = this.serviceContainer.get(types_1.IFileSystem);
            const promises = ['pytest.ini', 'tox.ini', 'setup.cfg']
                .map((cfg) => __awaiter(this, void 0, void 0, function* () { return (yield fs.fileExists(path.join(rootDir, cfg))) ? cfg : ''; }));
            const values = yield Promise.all(promises);
            return values.filter(exists => exists.length > 0);
        });
    }
}
exports.ConfigurationManager = ConfigurationManager;
//# sourceMappingURL=testConfigurationManager.js.map