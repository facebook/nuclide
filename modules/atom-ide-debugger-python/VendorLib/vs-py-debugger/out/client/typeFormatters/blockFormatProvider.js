"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const codeBlockFormatProvider_1 = require("./codeBlockFormatProvider");
const contracts_1 = require("./contracts");
const contracts_2 = require("./contracts");
const contracts_3 = require("./contracts");
class BlockFormatProviders {
    constructor() {
        this.providers = [];
        const boundaryBlocks = [
            contracts_3.DEF_REGEX,
            contracts_3.ASYNC_DEF_REGEX,
            contracts_3.CLASS_REGEX
        ];
        const elseParentBlocks = [
            contracts_1.IF_REGEX,
            contracts_1.ELIF_REGEX,
            contracts_1.FOR_IN_REGEX,
            contracts_1.ASYNC_FOR_IN_REGEX,
            contracts_1.WHILE_REGEX,
            contracts_2.TRY_REGEX,
            contracts_2.EXCEPT_REGEX
        ];
        this.providers.push(new codeBlockFormatProvider_1.CodeBlockFormatProvider(contracts_1.ELSE_REGEX, elseParentBlocks, boundaryBlocks));
        const elifParentBlocks = [
            contracts_1.IF_REGEX,
            contracts_1.ELIF_REGEX
        ];
        this.providers.push(new codeBlockFormatProvider_1.CodeBlockFormatProvider(contracts_1.ELIF_REGEX, elifParentBlocks, boundaryBlocks));
        const exceptParentBlocks = [
            contracts_2.TRY_REGEX,
            contracts_2.EXCEPT_REGEX
        ];
        this.providers.push(new codeBlockFormatProvider_1.CodeBlockFormatProvider(contracts_2.EXCEPT_REGEX, exceptParentBlocks, boundaryBlocks));
        const finallyParentBlocks = [
            contracts_2.TRY_REGEX,
            contracts_2.EXCEPT_REGEX
        ];
        this.providers.push(new codeBlockFormatProvider_1.CodeBlockFormatProvider(contracts_2.FINALLY_REGEX, finallyParentBlocks, boundaryBlocks));
    }
    provideOnTypeFormattingEdits(document, position, ch, options, token) {
        if (position.line === 0) {
            return [];
        }
        const currentLine = document.lineAt(position.line);
        const prevousLine = document.lineAt(position.line - 1);
        // We're only interested in cases where the current block is at the same indentation level as the previous line
        // E.g. if we have an if..else block, generally the else statement would be at the same level as the code in the if...
        if (currentLine.firstNonWhitespaceCharacterIndex !== prevousLine.firstNonWhitespaceCharacterIndex) {
            return [];
        }
        const currentLineText = currentLine.text;
        const provider = this.providers.find(p => p.canProvideEdits(currentLineText));
        if (provider) {
            return provider.provideEdits(document, position, ch, options, currentLine);
        }
        return [];
    }
}
exports.BlockFormatProviders = BlockFormatProviders;
//# sourceMappingURL=blockFormatProvider.js.map