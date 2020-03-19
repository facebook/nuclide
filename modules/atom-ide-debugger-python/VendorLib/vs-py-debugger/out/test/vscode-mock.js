// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:no-invalid-this no-require-imports no-var-requires no-any
const TypeMoq = require("typemoq");
const vscodeMocks = require("./mocks/vsc");
const telemetryReporter_1 = require("./mocks/vsc/telemetryReporter");
const Module = require('module');
const mockedVSCode = {};
const mockedVSCodeNamespaces = {};
const originalLoad = Module._load;
function generateMock(name) {
    const mockedObj = TypeMoq.Mock.ofType();
    mockedVSCode[name] = mockedObj.object;
    mockedVSCodeNamespaces[name] = mockedObj;
}
function initialize() {
    generateMock('workspace');
    generateMock('window');
    generateMock('commands');
    generateMock('languages');
    generateMock('env');
    generateMock('debug');
    generateMock('scm');
    // When upgrading to npm 9-10, this might have to change, as we could have explicit imports (named imports).
    Module._load = function (request, parent) {
        if (request === 'vscode') {
            return mockedVSCode;
        }
        if (request === 'vscode-extension-telemetry') {
            return { default: telemetryReporter_1.vscMockTelemetryReporter };
        }
        return originalLoad.apply(this, arguments);
    };
}
exports.initialize = initialize;
mockedVSCode.Disposable = vscodeMocks.vscMock.Disposable;
mockedVSCode.EventEmitter = vscodeMocks.vscMock.EventEmitter;
mockedVSCode.CancellationTokenSource = vscodeMocks.vscMock.CancellationTokenSource;
mockedVSCode.CompletionItemKind = vscodeMocks.vscMock.CompletionItemKind;
mockedVSCode.SymbolKind = vscodeMocks.vscMock.SymbolKind;
mockedVSCode.Uri = vscodeMocks.vscMock.Uri;
mockedVSCode.Range = vscodeMocks.vscMockExtHostedTypes.Range;
mockedVSCode.Position = vscodeMocks.vscMockExtHostedTypes.Position;
mockedVSCode.Selection = vscodeMocks.vscMockExtHostedTypes.Selection;
mockedVSCode.Location = vscodeMocks.vscMockExtHostedTypes.Location;
mockedVSCode.SymbolInformation = vscodeMocks.vscMockExtHostedTypes.SymbolInformation;
mockedVSCode.CompletionItem = vscodeMocks.vscMockExtHostedTypes.CompletionItem;
mockedVSCode.CompletionItemKind = vscodeMocks.vscMockExtHostedTypes.CompletionItemKind;
mockedVSCode.CodeLens = vscodeMocks.vscMockExtHostedTypes.CodeLens;
mockedVSCode.DiagnosticSeverity = vscodeMocks.vscMockExtHostedTypes.DiagnosticSeverity;
mockedVSCode.SnippetString = vscodeMocks.vscMockExtHostedTypes.SnippetString;
mockedVSCode.EventEmitter = vscodeMocks.vscMock.EventEmitter;
mockedVSCode.ConfigurationTarget = vscodeMocks.vscMockExtHostedTypes.ConfigurationTarget;
mockedVSCode.StatusBarAlignment = vscodeMocks.vscMockExtHostedTypes.StatusBarAlignment;
mockedVSCode.SignatureHelp = vscodeMocks.vscMockExtHostedTypes.SignatureHelp;
mockedVSCode.DocumentLink = vscodeMocks.vscMockExtHostedTypes.DocumentLink;
mockedVSCode.TextEdit = vscodeMocks.vscMockExtHostedTypes.TextEdit;
mockedVSCode.WorkspaceEdit = vscodeMocks.vscMockExtHostedTypes.WorkspaceEdit;
mockedVSCode.RelativePattern = vscodeMocks.vscMockExtHostedTypes.RelativePattern;
mockedVSCode.ProgressLocation = vscodeMocks.vscMockExtHostedTypes.ProgressLocation;
// This API is used in src/client/telemetry/telemetry.ts
const extensions = TypeMoq.Mock.ofType();
extensions.setup(e => e.all).returns(() => []);
const extension = TypeMoq.Mock.ofType();
const packageJson = TypeMoq.Mock.ofType();
const contributes = TypeMoq.Mock.ofType();
extension.setup(e => e.packageJSON).returns(() => packageJson.object);
packageJson.setup(p => p.contributes).returns(() => contributes.object);
contributes.setup(p => p.debuggers).returns(() => [{ aiKey: '' }]);
extensions.setup(e => e.getExtension(TypeMoq.It.isAny())).returns(() => extension.object);
mockedVSCode.extensions = extensions.object;
//# sourceMappingURL=vscode-mock.js.map