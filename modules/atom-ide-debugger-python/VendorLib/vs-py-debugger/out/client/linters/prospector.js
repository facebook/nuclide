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
require("../common/extensions");
const types_1 = require("../common/types");
const baseLinter_1 = require("./baseLinter");
class Prospector extends baseLinter_1.BaseLinter {
    constructor(outputChannel, serviceContainer) {
        super(types_1.Product.prospector, outputChannel, serviceContainer);
    }
    runLinter(document, cancellation) {
        return __awaiter(this, void 0, void 0, function* () {
            const cwd = this.getWorkspaceRootPath(document);
            const relativePath = path.relative(cwd, document.uri.fsPath);
            return this.run(['--absolute-paths', '--output-format=json', relativePath], document, cancellation);
        });
    }
    parseMessages(output, document, token, regEx) {
        return __awaiter(this, void 0, void 0, function* () {
            let parsedData;
            try {
                parsedData = JSON.parse(output);
            }
            catch (ex) {
                this.outputChannel.appendLine(`${'#'.repeat(10)}Linting Output - ${this.info.id}${'#'.repeat(10)}`);
                this.outputChannel.append(output);
                this.logger.logError('Failed to parse Prospector output', ex);
                return [];
            }
            return parsedData.messages
                .filter((value, index) => index <= this.pythonSettings.linting.maxNumberOfProblems)
                .map(msg => {
                const lineNumber = msg.location.line === null || isNaN(msg.location.line) ? 1 : msg.location.line;
                return {
                    code: msg.code,
                    message: msg.message,
                    column: msg.location.character,
                    line: lineNumber,
                    type: msg.code,
                    provider: `${this.info.id} - ${msg.source}`
                };
            });
        });
    }
}
exports.Prospector = Prospector;
//# sourceMappingURL=prospector.js.map