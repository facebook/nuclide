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
require("../common/extensions");
const types_1 = require("../common/types");
const baseLinter_1 = require("./baseLinter");
exports.REGEX = '(?<file>.+):(?<line>\\d+): (?<type>\\w+): (?<message>.*)\\r?(\\n|$)';
class MyPy extends baseLinter_1.BaseLinter {
    constructor(outputChannel, serviceContainer) {
        super(types_1.Product.mypy, outputChannel, serviceContainer);
    }
    runLinter(document, cancellation) {
        return __awaiter(this, void 0, void 0, function* () {
            const messages = yield this.run([document.uri.fsPath], document, cancellation, exports.REGEX);
            messages.forEach(msg => {
                msg.severity = this.parseMessagesSeverity(msg.type, this.pythonSettings.linting.mypyCategorySeverity);
                msg.code = msg.type;
            });
            return messages;
        });
    }
}
exports.MyPy = MyPy;
//# sourceMappingURL=mypy.js.map