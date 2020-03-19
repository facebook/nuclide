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
const types_1 = require("../../common/types");
const testConfigurationManager_1 = require("../common/managers/testConfigurationManager");
class ConfigurationManager extends testConfigurationManager_1.TestConfigurationManager {
    constructor(workspace, serviceContainer) {
        super(workspace, types_1.Product.unittest, serviceContainer);
    }
    requiresUserToConfigure(_wkspace) {
        return __awaiter(this, void 0, void 0, function* () {
            return true;
        });
    }
    configure(wkspace) {
        return __awaiter(this, void 0, void 0, function* () {
            const args = ['-v'];
            const subDirs = yield this.getTestDirs(wkspace.fsPath);
            const testDir = yield this.selectTestDir(wkspace.fsPath, subDirs);
            args.push('-s');
            if (typeof testDir === 'string' && testDir !== '.') {
                args.push(`./${testDir}`);
            }
            else {
                args.push('.');
            }
            const testfilePattern = yield this.selectTestFilePattern();
            args.push('-p');
            if (typeof testfilePattern === 'string') {
                args.push(testfilePattern);
            }
            else {
                args.push('test*.py');
            }
            yield this.testConfigSettingsService.updateTestArgs(wkspace.fsPath, types_1.Product.unittest, args);
        });
    }
}
exports.ConfigurationManager = ConfigurationManager;
//# sourceMappingURL=testConfigurationManager.js.map