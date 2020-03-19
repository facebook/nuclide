// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:no-invalid-this no-require-imports no-var-requires no-any max-classes-per-file
const events_1 = require("events");
// export * from './range';
// export * from './position';
// export * from './selection';
__export(require("./extHostedTypes"));
var vscMock;
(function (vscMock) {
    // This is one of the very few classes that we need in our unit tests.
    // It is constructed in a number of places, and this is required for verification.
    // Using mocked objects for verfications does not work in typemoq.
    class Uri {
        constructor(scheme, authority, path, query, fragment, fsPath) {
            this.scheme = scheme;
            this.authority = authority;
            this.path = path;
            this.query = query;
            this.fragment = fragment;
            this.fsPath = fsPath;
        }
        static file(path) {
            return new Uri('file', '', path, '', '', path);
        }
        static parse(value) {
            return new Uri('http', '', value, '', '', value);
        }
        with(change) {
            throw new Error('Not implemented');
        }
        toString(skipEncoding) {
            return this.fsPath;
        }
        toJSON() {
            return this.fsPath;
        }
    }
    vscMock.Uri = Uri;
    class Disposable {
        constructor(callOnDispose) {
            this.callOnDispose = callOnDispose;
        }
        dispose() {
            if (this.callOnDispose) {
                this.callOnDispose();
            }
        }
    }
    vscMock.Disposable = Disposable;
    class EventEmitter {
        constructor() {
            this.add = (listener, thisArgs, disposables) => {
                this.emitter.addListener('evt', listener);
                return {
                    dispose: () => {
                        this.emitter.removeListener('evt', listener);
                    }
                };
            };
            this.event = this.add.bind(this);
            this.emitter = new events_1.EventEmitter();
        }
        fire(data) {
            this.emitter.emit('evt', data);
        }
        dispose() {
            this.emitter.removeAllListeners();
        }
    }
    vscMock.EventEmitter = EventEmitter;
    class CancellationToken extends EventEmitter {
        constructor() {
            super();
            this.onCancellationRequested = this.add.bind(this);
        }
        cancel() {
            this.isCancellationRequested = true;
            this.fire();
        }
    }
    vscMock.CancellationToken = CancellationToken;
    class CancellationTokenSource {
        constructor() {
            this.token = new CancellationToken();
        }
        cancel() {
            this.token.cancel();
        }
        dispose() {
            this.token.dispose();
        }
    }
    vscMock.CancellationTokenSource = CancellationTokenSource;
    let CompletionItemKind;
    (function (CompletionItemKind) {
        CompletionItemKind[CompletionItemKind["Text"] = 0] = "Text";
        CompletionItemKind[CompletionItemKind["Method"] = 1] = "Method";
        CompletionItemKind[CompletionItemKind["Function"] = 2] = "Function";
        CompletionItemKind[CompletionItemKind["Constructor"] = 3] = "Constructor";
        CompletionItemKind[CompletionItemKind["Field"] = 4] = "Field";
        CompletionItemKind[CompletionItemKind["Variable"] = 5] = "Variable";
        CompletionItemKind[CompletionItemKind["Class"] = 6] = "Class";
        CompletionItemKind[CompletionItemKind["Interface"] = 7] = "Interface";
        CompletionItemKind[CompletionItemKind["Module"] = 8] = "Module";
        CompletionItemKind[CompletionItemKind["Property"] = 9] = "Property";
        CompletionItemKind[CompletionItemKind["Unit"] = 10] = "Unit";
        CompletionItemKind[CompletionItemKind["Value"] = 11] = "Value";
        CompletionItemKind[CompletionItemKind["Enum"] = 12] = "Enum";
        CompletionItemKind[CompletionItemKind["Keyword"] = 13] = "Keyword";
        CompletionItemKind[CompletionItemKind["Snippet"] = 14] = "Snippet";
        CompletionItemKind[CompletionItemKind["Color"] = 15] = "Color";
        CompletionItemKind[CompletionItemKind["Reference"] = 17] = "Reference";
        CompletionItemKind[CompletionItemKind["File"] = 16] = "File";
        CompletionItemKind[CompletionItemKind["Folder"] = 18] = "Folder";
        CompletionItemKind[CompletionItemKind["EnumMember"] = 19] = "EnumMember";
        CompletionItemKind[CompletionItemKind["Constant"] = 20] = "Constant";
        CompletionItemKind[CompletionItemKind["Struct"] = 21] = "Struct";
        CompletionItemKind[CompletionItemKind["Event"] = 22] = "Event";
        CompletionItemKind[CompletionItemKind["Operator"] = 23] = "Operator";
        CompletionItemKind[CompletionItemKind["TypeParameter"] = 24] = "TypeParameter";
    })(CompletionItemKind = vscMock.CompletionItemKind || (vscMock.CompletionItemKind = {}));
    let SymbolKind;
    (function (SymbolKind) {
        SymbolKind[SymbolKind["File"] = 0] = "File";
        SymbolKind[SymbolKind["Module"] = 1] = "Module";
        SymbolKind[SymbolKind["Namespace"] = 2] = "Namespace";
        SymbolKind[SymbolKind["Package"] = 3] = "Package";
        SymbolKind[SymbolKind["Class"] = 4] = "Class";
        SymbolKind[SymbolKind["Method"] = 5] = "Method";
        SymbolKind[SymbolKind["Property"] = 6] = "Property";
        SymbolKind[SymbolKind["Field"] = 7] = "Field";
        SymbolKind[SymbolKind["Constructor"] = 8] = "Constructor";
        SymbolKind[SymbolKind["Enum"] = 9] = "Enum";
        SymbolKind[SymbolKind["Interface"] = 10] = "Interface";
        SymbolKind[SymbolKind["Function"] = 11] = "Function";
        SymbolKind[SymbolKind["Variable"] = 12] = "Variable";
        SymbolKind[SymbolKind["Constant"] = 13] = "Constant";
        SymbolKind[SymbolKind["String"] = 14] = "String";
        SymbolKind[SymbolKind["Number"] = 15] = "Number";
        SymbolKind[SymbolKind["Boolean"] = 16] = "Boolean";
        SymbolKind[SymbolKind["Array"] = 17] = "Array";
        SymbolKind[SymbolKind["Object"] = 18] = "Object";
        SymbolKind[SymbolKind["Key"] = 19] = "Key";
        SymbolKind[SymbolKind["Null"] = 20] = "Null";
        SymbolKind[SymbolKind["EnumMember"] = 21] = "EnumMember";
        SymbolKind[SymbolKind["Struct"] = 22] = "Struct";
        SymbolKind[SymbolKind["Event"] = 23] = "Event";
        SymbolKind[SymbolKind["Operator"] = 24] = "Operator";
        SymbolKind[SymbolKind["TypeParameter"] = 25] = "TypeParameter";
    })(SymbolKind = vscMock.SymbolKind || (vscMock.SymbolKind = {}));
})(vscMock = exports.vscMock || (exports.vscMock = {}));
//# sourceMappingURL=index.js.map