// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const TypeMoq = require("typemoq");
const vscode_1 = require("vscode");
const codeActionsProvider_1 = require("../../client/providers/codeActionsProvider");
suite('CodeAction Provider', () => {
    let codeActionsProvider;
    let document;
    let range;
    let context;
    let token;
    setup(() => {
        codeActionsProvider = new codeActionsProvider_1.PythonCodeActionProvider();
        document = TypeMoq.Mock.ofType();
        range = TypeMoq.Mock.ofType();
        context = TypeMoq.Mock.ofType();
        token = TypeMoq.Mock.ofType();
    });
    test('Ensure it always returns a source.organizeImports CodeAction', () => __awaiter(this, void 0, void 0, function* () {
        const codeActions = yield codeActionsProvider.provideCodeActions(document.object, range.object, context.object, token.object);
        if (!codeActions) {
            throw Error(`codeActionsProvider.provideCodeActions did not return an array (it returned ${codeActions})`);
        }
        const organizeImportsCodeAction = codeActions.filter(codeAction => codeAction.kind === vscode_1.CodeActionKind.SourceOrganizeImports);
        chai_1.expect(organizeImportsCodeAction).to.have.length(1);
        chai_1.expect(organizeImportsCodeAction[0].kind).to.eq(vscode_1.CodeActionKind.SourceOrganizeImports);
    }));
});
//# sourceMappingURL=codeActionsProvider.test.js.map