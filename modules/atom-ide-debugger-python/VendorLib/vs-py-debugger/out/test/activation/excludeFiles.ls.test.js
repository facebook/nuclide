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
const path = require("path");
const vscode_1 = require("vscode");
const service_1 = require("../../client/common/configuration/service");
require("../../client/common/extensions");
const types_1 = require("../../client/common/types");
const container_1 = require("../../client/ioc/container");
const serviceManager_1 = require("../../client/ioc/serviceManager");
const constants_1 = require("../constants");
const initialize_1 = require("../initialize");
const wksPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'exclusions');
const fileOne = path.join(wksPath, 'one.py');
// tslint:disable-next-line:max-func-body-length
suite('Exclude files (Language Server)', () => {
    let textDocument;
    let serviceManager;
    let serviceContainer;
    let configService;
    suiteSetup(function () {
        return __awaiter(this, void 0, void 0, function* () {
            if (!constants_1.IsLanguageServerTest()) {
                // tslint:disable-next-line:no-invalid-this
                this.skip();
            }
        });
    });
    setup(() => __awaiter(this, void 0, void 0, function* () {
        const cont = new inversify_1.Container();
        serviceContainer = new container_1.ServiceContainer(cont);
        serviceManager = new serviceManager_1.ServiceManager(cont);
        serviceManager.addSingleton(types_1.IConfigurationService, service_1.ConfigurationService);
        configService = serviceManager.get(types_1.IConfigurationService);
    }));
    suiteTeardown(initialize_1.closeActiveWindows);
    teardown(initialize_1.closeActiveWindows);
    function openFile(file) {
        return __awaiter(this, void 0, void 0, function* () {
            yield initialize_1.activateExtension();
            textDocument = yield vscode_1.workspace.openTextDocument(file);
            yield vscode_1.window.showTextDocument(textDocument);
            // Make sure LS completes file loading and analysis.
            // In test mode it awaits for the completion before trying
            // to fetch data for completion, hover.etc.
            yield vscode_1.commands.executeCommand('vscode.executeCompletionItemProvider', textDocument.uri, new vscode_1.Position(0, 0));
        });
    }
    function setSetting(name, value) {
        return __awaiter(this, void 0, void 0, function* () {
            yield configService.updateSetting(name, value, undefined, vscode_1.ConfigurationTarget.Global);
        });
    }
    test('Default exclusions', () => __awaiter(this, void 0, void 0, function* () {
        yield openFile(fileOne);
        const diag = vscode_1.languages.getDiagnostics();
        const main = diag.filter(d => d[0].fsPath.indexOf('one.py') >= 0);
        assert.equal(main.length > 0, true);
        const subdir = diag.filter(d => d[0].fsPath.indexOf('three.py') >= 0);
        assert.equal(subdir.length > 0, true);
        const node_modules = diag.filter(d => d[0].fsPath.indexOf('node.py') >= 0);
        assert.equal(node_modules.length, 0);
        const lib = diag.filter(d => d[0].fsPath.indexOf('fileLib.py') >= 0);
        assert.equal(lib.length, 0);
        const sitePackages = diag.filter(d => d[0].fsPath.indexOf('sitePackages.py') >= 0);
        assert.equal(sitePackages.length, 0);
    }));
    test('Exclude subfolder', () => __awaiter(this, void 0, void 0, function* () {
        yield setSetting('linting.ignorePatterns', ['**/dir1/**']);
        yield openFile(fileOne);
        const diag = vscode_1.languages.getDiagnostics();
        const main = diag.filter(d => d[0].fsPath.indexOf('one.py') >= 0);
        assert.equal(main.length > 0, true);
        const subdir1 = diag.filter(d => d[0].fsPath.indexOf('dir1file.py') >= 0);
        assert.equal(subdir1.length, 0);
        const subdir2 = diag.filter(d => d[0].fsPath.indexOf('dir2file.py') >= 0);
        assert.equal(subdir2.length, 0);
        yield setSetting('linting.ignorePatterns', undefined);
    }));
});
//# sourceMappingURL=excludeFiles.ls.test.js.map