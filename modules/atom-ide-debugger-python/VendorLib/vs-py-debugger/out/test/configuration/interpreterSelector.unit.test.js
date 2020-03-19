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
const TypeMoq = require("typemoq");
const types_1 = require("../../client/common/application/types");
const pathUtils_1 = require("../../client/common/platform/pathUtils");
const types_2 = require("../../client/common/platform/types");
const types_3 = require("../../client/common/types");
const platform_1 = require("../../client/common/utils/platform");
const interpreterSelector_1 = require("../../client/interpreter/configuration/interpreterSelector");
const types_4 = require("../../client/interpreter/configuration/types");
const contracts_1 = require("../../client/interpreter/contracts");
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
class InterpreterQuickPickItem {
    constructor(l, p) {
        this.path = p;
        this.label = l;
    }
}
// tslint:disable-next-line:max-func-body-length
suite('Interpreters - selector', () => {
    let serviceContainer;
    let workspace;
    let appShell;
    let interpreterService;
    let documentManager;
    let fileSystem;
    setup(() => {
        const commandManager = TypeMoq.Mock.ofType();
        const comparer = TypeMoq.Mock.ofType();
        serviceContainer = TypeMoq.Mock.ofType();
        appShell = TypeMoq.Mock.ofType();
        interpreterService = TypeMoq.Mock.ofType();
        documentManager = TypeMoq.Mock.ofType();
        workspace = TypeMoq.Mock.ofType();
        fileSystem = TypeMoq.Mock.ofType();
        fileSystem
            .setup(x => x.arePathsSame(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString()))
            .returns((a, b) => a === b);
        fileSystem
            .setup(x => x.getRealPath(TypeMoq.It.isAnyString()))
            .returns((a) => new Promise(resolve => resolve(a)));
        comparer.setup(c => c.compare(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => 0);
        serviceContainer.setup(c => c.get(types_1.IWorkspaceService)).returns(() => workspace.object);
        serviceContainer.setup(c => c.get(types_1.IApplicationShell)).returns(() => appShell.object);
        serviceContainer.setup(c => c.get(contracts_1.IInterpreterService)).returns(() => interpreterService.object);
        serviceContainer.setup(c => c.get(types_1.IDocumentManager)).returns(() => documentManager.object);
        serviceContainer.setup(c => c.get(types_2.IFileSystem)).returns(() => fileSystem.object);
        serviceContainer.setup(c => c.get(types_4.IInterpreterComparer)).returns(() => comparer.object);
        serviceContainer.setup(c => c.get(types_1.ICommandManager)).returns(() => commandManager.object);
    });
    [true, false].forEach(isWindows => {
        test(`Suggestions (${isWindows} ? 'Windows' : 'Non-Windows')`, () => __awaiter(this, void 0, void 0, function* () {
            serviceContainer
                .setup(c => c.get(types_3.IPathUtils))
                .returns(() => new pathUtils_1.PathUtils(isWindows));
            const initial = [
                { displayName: '1', path: 'c:/path1/path1', type: contracts_1.InterpreterType.Unknown },
                { displayName: '2', path: 'c:/path1/path1', type: contracts_1.InterpreterType.Unknown },
                { displayName: '2', path: 'c:/path2/path2', type: contracts_1.InterpreterType.Unknown },
                { displayName: '2 (virtualenv)', path: 'c:/path2/path2', type: contracts_1.InterpreterType.VirtualEnv },
                { displayName: '3', path: 'c:/path2/path2', type: contracts_1.InterpreterType.Unknown },
                { displayName: '4', path: 'c:/path4/path4', type: contracts_1.InterpreterType.Conda }
            ].map(item => { return Object.assign({}, info, item); });
            interpreterService
                .setup(x => x.getInterpreters(TypeMoq.It.isAny()))
                .returns(() => new Promise((resolve) => resolve(initial)));
            const selector = new interpreterSelector_1.InterpreterSelector(serviceContainer.object);
            const actual = yield selector.getSuggestions();
            const expected = [
                new InterpreterQuickPickItem('1', 'c:/path1/path1'),
                new InterpreterQuickPickItem('2', 'c:/path1/path1'),
                new InterpreterQuickPickItem('2', 'c:/path2/path2'),
                new InterpreterQuickPickItem('2 (virtualenv)', 'c:/path2/path2'),
                new InterpreterQuickPickItem('3', 'c:/path2/path2'),
                new InterpreterQuickPickItem('4', 'c:/path4/path4')
            ];
            assert.equal(actual.length, expected.length, 'Suggestion lengths are different.');
            for (let i = 0; i < expected.length; i += 1) {
                assert.equal(actual[i].label, expected[i].label, `Suggestion label is different at ${i}: exected '${expected[i].label}', found '${actual[i].label}'.`);
                assert.equal(actual[i].path, expected[i].path, `Suggestion path is different at ${i}: exected '${expected[i].path}', found '${actual[i].path}'.`);
            }
        }));
    });
});
//# sourceMappingURL=interpreterSelector.unit.test.js.map