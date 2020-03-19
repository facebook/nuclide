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
const timers_1 = require("timers");
const types_1 = require("../common/application/types");
const types_2 = require("../common/types");
const autoPep8Formatter_1 = require("./../formatters/autoPep8Formatter");
const blackFormatter_1 = require("./../formatters/blackFormatter");
const dummyFormatter_1 = require("./../formatters/dummyFormatter");
const yapfFormatter_1 = require("./../formatters/yapfFormatter");
class PythonFormattingEditProvider {
    constructor(context, serviceContainer) {
        this.formatters = new Map();
        this.disposables = [];
        // Workaround for https://github.com/Microsoft/vscode/issues/41194
        this.documentVersionBeforeFormatting = -1;
        this.formatterMadeChanges = false;
        this.saving = false;
        const yapfFormatter = new yapfFormatter_1.YapfFormatter(serviceContainer);
        const autoPep8 = new autoPep8Formatter_1.AutoPep8Formatter(serviceContainer);
        const black = new blackFormatter_1.BlackFormatter(serviceContainer);
        const dummy = new dummyFormatter_1.DummyFormatter(serviceContainer);
        this.formatters.set(yapfFormatter.Id, yapfFormatter);
        this.formatters.set(black.Id, black);
        this.formatters.set(autoPep8.Id, autoPep8);
        this.formatters.set(dummy.Id, dummy);
        this.commands = serviceContainer.get(types_1.ICommandManager);
        this.workspace = serviceContainer.get(types_1.IWorkspaceService);
        this.documentManager = serviceContainer.get(types_1.IDocumentManager);
        this.config = serviceContainer.get(types_2.IConfigurationService);
        this.disposables.push(this.documentManager.onDidSaveTextDocument((document) => __awaiter(this, void 0, void 0, function* () { return this.onSaveDocument(document); })));
    }
    dispose() {
        this.disposables.forEach(d => d.dispose());
    }
    provideDocumentFormattingEdits(document, options, token) {
        return this.provideDocumentRangeFormattingEdits(document, undefined, options, token);
    }
    provideDocumentRangeFormattingEdits(document, range, options, token) {
        return __awaiter(this, void 0, void 0, function* () {
            // Workaround for https://github.com/Microsoft/vscode/issues/41194
            // VSC rejects 'format on save' promise in 750 ms. Python formatting may take quite a bit longer.
            // Workaround is to resolve promise to nothing here, then execute format document and force new save.
            // However, we need to know if this is 'format document' or formatting on save.
            if (this.saving) {
                // We are saving after formatting (see onSaveDocument below)
                // so we do not want to format again.
                return [];
            }
            // Remember content before formatting so we can detect if
            // formatting edits have been really applied
            const editorConfig = this.workspace.getConfiguration('editor', document.uri);
            if (editorConfig.get('formatOnSave') === true) {
                this.documentVersionBeforeFormatting = document.version;
            }
            const settings = this.config.getSettings(document.uri);
            const formatter = this.formatters.get(settings.formatting.provider);
            const edits = yield formatter.formatDocument(document, options, token, range);
            this.formatterMadeChanges = edits.length > 0;
            return edits;
        });
    }
    onSaveDocument(document) {
        return __awaiter(this, void 0, void 0, function* () {
            // Promise was rejected = formatting took too long.
            // Don't format inside the event handler, do it on timeout
            timers_1.setTimeout(() => {
                try {
                    if (this.formatterMadeChanges
                        && !document.isDirty
                        && document.version === this.documentVersionBeforeFormatting) {
                        // Formatter changes were not actually applied due to the timeout on save.
                        // Force formatting now and then save the document.
                        this.commands.executeCommand('editor.action.formatDocument').then(() => __awaiter(this, void 0, void 0, function* () {
                            this.saving = true;
                            yield document.save();
                            this.saving = false;
                        }));
                    }
                }
                finally {
                    this.documentVersionBeforeFormatting = -1;
                    this.saving = false;
                    this.formatterMadeChanges = false;
                }
            }, 50);
        });
    }
}
exports.PythonFormattingEditProvider = PythonFormattingEditProvider;
//# sourceMappingURL=formatProvider.js.map