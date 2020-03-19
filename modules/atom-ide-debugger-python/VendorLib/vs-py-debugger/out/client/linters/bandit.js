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
require("../common/extensions");
const types_1 = require("../common/types");
const baseLinter_1 = require("./baseLinter");
const types_2 = require("./types");
class Bandit extends baseLinter_1.BaseLinter {
    constructor(outputChannel, serviceContainer) {
        super(types_1.Product.bandit, outputChannel, serviceContainer);
    }
    runLinter(document, cancellation) {
        return __awaiter(this, void 0, void 0, function* () {
            // View all errors in bandit <= 1.5.1 (https://github.com/PyCQA/bandit/issues/371)
            const messages = yield this.run([
                '-f', 'custom', '--msg-template', '{line},0,{severity},{test_id}:{msg}', '-n', '-1', document.uri.fsPath
            ], document, cancellation);
            messages.forEach(msg => {
                msg.severity = {
                    LOW: types_2.LintMessageSeverity.Information,
                    MEDIUM: types_2.LintMessageSeverity.Warning,
                    HIGH: types_2.LintMessageSeverity.Error
                }[msg.type];
            });
            return messages;
        });
    }
}
exports.Bandit = Bandit;
//# sourceMappingURL=bandit.js.map