"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class BlockRegEx {
    constructor(regEx, startWord) {
        this.regEx = regEx;
        this.startWord = startWord;
    }
    test(value) {
        // Clear the cache
        this.regEx.lastIndex = -1;
        return this.regEx.test(value);
    }
}
exports.BlockRegEx = BlockRegEx;
exports.IF_REGEX = new BlockRegEx(/^( |\t)*if +.*: *$/g, 'if');
exports.ELIF_REGEX = new BlockRegEx(/^( |\t)*elif +.*: *$/g, 'elif');
exports.ELSE_REGEX = new BlockRegEx(/^( |\t)*else *: *$/g, 'else');
exports.FOR_IN_REGEX = new BlockRegEx(/^( |\t)*for \w in .*: *$/g, 'for');
exports.ASYNC_FOR_IN_REGEX = new BlockRegEx(/^( |\t)*async *for \w in .*: *$/g, 'for');
exports.WHILE_REGEX = new BlockRegEx(/^( |\t)*while .*: *$/g, 'while');
exports.TRY_REGEX = new BlockRegEx(/^( |\t)*try *: *$/g, 'try');
exports.FINALLY_REGEX = new BlockRegEx(/^( |\t)*finally *: *$/g, 'finally');
exports.EXCEPT_REGEX = new BlockRegEx(/^( |\t)*except *\w* *(as)? *\w* *: *$/g, 'except');
exports.DEF_REGEX = new BlockRegEx(/^( |\t)*def \w *\(.*$/g, 'def');
exports.ASYNC_DEF_REGEX = new BlockRegEx(/^( |\t)*async *def \w *\(.*$/g, 'async');
exports.CLASS_REGEX = new BlockRegEx(/^( |\t)*class *\w* *.*: *$/g, 'class');
//# sourceMappingURL=contracts.js.map