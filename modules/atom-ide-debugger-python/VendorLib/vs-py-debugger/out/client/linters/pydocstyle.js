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
const util_1 = require("./../common/util");
const baseLinter_1 = require("./baseLinter");
const types_2 = require("./types");
class PyDocStyle extends baseLinter_1.BaseLinter {
    constructor(outputChannel, serviceContainer) {
        super(types_1.Product.pydocstyle, outputChannel, serviceContainer);
    }
    runLinter(document, cancellation) {
        return __awaiter(this, void 0, void 0, function* () {
            const messages = yield this.run([document.uri.fsPath], document, cancellation);
            // All messages in pep8 are treated as warnings for now.
            messages.forEach(msg => {
                msg.severity = types_2.LintMessageSeverity.Warning;
            });
            return messages;
        });
    }
    parseMessages(output, document, token, regEx) {
        return __awaiter(this, void 0, void 0, function* () {
            let outputLines = output.split(/\r?\n/g);
            const baseFileName = path.basename(document.uri.fsPath);
            // Remember, the first line of the response contains the file name and line number, the next line contains the error message.
            // So we have two lines per message, hence we need to take lines in pairs.
            const maxLines = this.pythonSettings.linting.maxNumberOfProblems * 2;
            // First line is almost always empty.
            const oldOutputLines = outputLines.filter(line => line.length > 0);
            outputLines = [];
            for (let counter = 0; counter < oldOutputLines.length / 2; counter += 1) {
                outputLines.push(oldOutputLines[2 * counter] + oldOutputLines[(2 * counter) + 1]);
            }
            return outputLines
                .filter((value, index) => index < maxLines && value.indexOf(':') >= 0)
                .map(line => {
                // Windows will have a : after the drive letter (e.g. c:\).
                if (util_1.IS_WINDOWS) {
                    return line.substring(line.indexOf(`${baseFileName}:`) + baseFileName.length + 1).trim();
                }
                return line.substring(line.indexOf(':') + 1).trim();
            })
                // Iterate through the lines (skipping the messages).
                // So, just iterate the response in pairs.
                .map(line => {
                try {
                    if (line.trim().length === 0) {
                        return;
                    }
                    const lineNumber = parseInt(line.substring(0, line.indexOf(' ')), 10);
                    const part = line.substring(line.indexOf(':') + 1).trim();
                    const code = part.substring(0, part.indexOf(':')).trim();
                    const message = part.substring(part.indexOf(':') + 1).trim();
                    const sourceLine = document.lineAt(lineNumber - 1).text;
                    const trmmedSourceLine = sourceLine.trim();
                    const sourceStart = sourceLine.indexOf(trmmedSourceLine);
                    // tslint:disable-next-line:no-object-literal-type-assertion
                    return {
                        code: code,
                        message: message,
                        column: sourceStart,
                        line: lineNumber,
                        type: '',
                        provider: this.info.id
                    };
                }
                catch (ex) {
                    this.logger.logError(`Failed to parse pydocstyle line '${line}'`, ex);
                    return;
                }
            })
                .filter(item => item !== undefined)
                .map(item => item);
        });
    }
}
exports.PyDocStyle = PyDocStyle;
//# sourceMappingURL=pydocstyle.js.map