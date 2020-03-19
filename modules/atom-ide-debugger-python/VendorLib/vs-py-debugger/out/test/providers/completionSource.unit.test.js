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
// tslint:disable:max-func-body-length no-any
const TypeMoq = require("typemoq");
const vscode_1 = require("vscode");
const types_1 = require("../../client/common/types");
const jediProxyFactory_1 = require("../../client/languageServices/jediProxyFactory");
const completionSource_1 = require("../../client/providers/completionSource");
suite('Completion Provider', () => {
    let completionSource;
    let jediHandler;
    let autoCompleteSettings;
    let itemInfoSource;
    setup(() => {
        const jediFactory = TypeMoq.Mock.ofType(jediProxyFactory_1.JediFactory);
        jediHandler = TypeMoq.Mock.ofType();
        const serviceContainer = TypeMoq.Mock.ofType();
        const configService = TypeMoq.Mock.ofType();
        const pythonSettings = TypeMoq.Mock.ofType();
        autoCompleteSettings = TypeMoq.Mock.ofType();
        autoCompleteSettings = TypeMoq.Mock.ofType();
        jediFactory.setup(j => j.getJediProxyHandler(TypeMoq.It.isAny()))
            .returns(() => jediHandler.object);
        serviceContainer.setup(s => s.get(TypeMoq.It.isValue(types_1.IConfigurationService), TypeMoq.It.isAny()))
            .returns(() => configService.object);
        configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);
        pythonSettings.setup(p => p.autoComplete).returns(() => autoCompleteSettings.object);
        itemInfoSource = TypeMoq.Mock.ofType();
        completionSource = new completionSource_1.CompletionSource(jediFactory.object, serviceContainer.object, itemInfoSource.object);
    });
    function testDocumentation(source, addBrackets) {
        return __awaiter(this, void 0, void 0, function* () {
            const doc = TypeMoq.Mock.ofType();
            const position = new vscode_1.Position(1, 1);
            const token = new vscode_1.CancellationTokenSource().token;
            const lineText = TypeMoq.Mock.ofType();
            const completionResult = TypeMoq.Mock.ofType();
            const autoCompleteItems = [{
                    description: 'description', kind: vscode_1.SymbolKind.Function,
                    raw_docstring: 'raw docstring',
                    rawType: vscode_1.CompletionItemKind.Function,
                    rightLabel: 'right label',
                    text: 'some text', type: vscode_1.CompletionItemKind.Function
                }];
            autoCompleteSettings.setup(a => a.addBrackets).returns(() => addBrackets);
            doc.setup(d => d.fileName).returns(() => '');
            doc.setup(d => d.getText(TypeMoq.It.isAny())).returns(() => source);
            doc.setup(d => d.lineAt(TypeMoq.It.isAny())).returns(() => lineText.object);
            doc.setup(d => d.offsetAt(TypeMoq.It.isAny())).returns(() => 0);
            lineText.setup(l => l.text).returns(() => source);
            completionResult.setup(c => c.requestId).returns(() => 1);
            completionResult.setup(c => c.items).returns(() => autoCompleteItems);
            completionResult.setup((c) => c.then).returns(() => undefined);
            jediHandler.setup(j => j.sendCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {
                return Promise.resolve(completionResult.object);
            });
            const expectedSource = `${source}${autoCompleteItems[0].text}`;
            itemInfoSource.setup(i => i.getItemInfoFromText(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), expectedSource, TypeMoq.It.isAny()))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.once());
            const [item] = yield completionSource.getVsCodeCompletionItems(doc.object, position, token);
            yield completionSource.getDocumentation(item, token);
            itemInfoSource.verifyAll();
        });
    }
    test('Ensure docs are provided when \'addBrackets\' setting is false', () => __awaiter(this, void 0, void 0, function* () {
        const source = 'if True:\n    print("Hello")\n';
        yield testDocumentation(source, false);
    }));
    test('Ensure docs are provided when \'addBrackets\' setting is true', () => __awaiter(this, void 0, void 0, function* () {
        const source = 'if True:\n    print("Hello")\n';
        yield testDocumentation(source, true);
    }));
});
//# sourceMappingURL=completionSource.unit.test.js.map