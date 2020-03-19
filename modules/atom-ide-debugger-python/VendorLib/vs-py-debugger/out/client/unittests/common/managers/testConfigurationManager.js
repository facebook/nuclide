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
const vscode_1 = require("vscode");
const types_1 = require("../../../common/types");
const async_1 = require("../../../common/utils/async");
const fs_1 = require("../../../common/utils/fs");
const constants_1 = require("../constants");
const types_2 = require("./../types");
class TestConfigurationManager {
    constructor(workspace, product, serviceContainer) {
        this.workspace = workspace;
        this.product = product;
        this.serviceContainer = serviceContainer;
        this.outputChannel = serviceContainer.get(types_1.IOutputChannel, constants_1.TEST_OUTPUT_CHANNEL);
        this.installer = serviceContainer.get(types_1.IInstaller);
        this.testConfigSettingsService = serviceContainer.get(types_2.ITestConfigSettingsService);
    }
    enable() {
        return __awaiter(this, void 0, void 0, function* () {
            // Disable other test frameworks.
            const testProducsToDisable = [types_1.Product.pytest, types_1.Product.unittest, types_1.Product.nosetest]
                .filter(item => item !== this.product);
            for (const prod of testProducsToDisable) {
                yield this.testConfigSettingsService.disable(this.workspace, prod);
            }
            return this.testConfigSettingsService.enable(this.workspace, this.product);
        });
    }
    // tslint:disable-next-line:no-any
    disable() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.testConfigSettingsService.enable(this.workspace, this.product);
        });
    }
    selectTestDir(rootDir, subDirs, customOptions = []) {
        const options = {
            matchOnDescription: true,
            matchOnDetail: true,
            placeHolder: 'Select the directory containing the unit tests'
        };
        let items = subDirs
            .map(dir => {
            const dirName = path.relative(rootDir, dir);
            if (dirName.indexOf('.') === 0) {
                return;
            }
            return {
                label: dirName,
                description: ''
            };
        })
            .filter(item => item !== undefined)
            .map(item => item);
        items = [{ label: '.', description: 'Root directory' }, ...items];
        items = customOptions.concat(items);
        const def = async_1.createDeferred();
        vscode_1.window.showQuickPick(items, options).then(item => {
            if (!item) {
                return def.resolve();
            }
            def.resolve(item.label);
        });
        return def.promise;
    }
    selectTestFilePattern() {
        const options = {
            matchOnDescription: true,
            matchOnDetail: true,
            placeHolder: 'Select the pattern to identify test files'
        };
        const items = [
            { label: '*test.py', description: 'Python Files ending with \'test\'' },
            { label: '*_test.py', description: 'Python Files ending with \'_test\'' },
            { label: 'test*.py', description: 'Python Files begining with \'test\'' },
            { label: 'test_*.py', description: 'Python Files begining with \'test_\'' },
            { label: '*test*.py', description: 'Python Files containing the word \'test\'' }
        ];
        const def = async_1.createDeferred();
        vscode_1.window.showQuickPick(items, options).then(item => {
            if (!item) {
                return def.resolve();
            }
            def.resolve(item.label);
        });
        return def.promise;
    }
    getTestDirs(rootDir) {
        return fs_1.getSubDirectories(rootDir).then(subDirs => {
            subDirs.sort();
            // Find out if there are any dirs with the name test and place them on the top.
            const possibleTestDirs = subDirs.filter(dir => dir.match(/test/i));
            const nonTestDirs = subDirs.filter(dir => possibleTestDirs.indexOf(dir) === -1);
            possibleTestDirs.push(...nonTestDirs);
            // The test dirs are now on top.
            return possibleTestDirs;
        });
    }
}
exports.TestConfigurationManager = TestConfigurationManager;
//# sourceMappingURL=testConfigurationManager.js.map