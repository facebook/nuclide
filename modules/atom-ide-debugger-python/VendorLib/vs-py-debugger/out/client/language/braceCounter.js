"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("./types");
class BracePair {
    constructor(openBrace, closeBrace) {
        this.openBrace = openBrace;
        this.closeBrace = closeBrace;
    }
}
class Stack {
    constructor() {
        this.store = [];
    }
    push(val) {
        this.store.push(val);
    }
    pop() {
        return this.store.pop();
    }
    get length() {
        return this.store.length;
    }
}
class BraceCounter {
    constructor() {
        this.bracePairs = [
            new BracePair(types_1.TokenType.OpenBrace, types_1.TokenType.CloseBrace),
            new BracePair(types_1.TokenType.OpenBracket, types_1.TokenType.CloseBracket),
            new BracePair(types_1.TokenType.OpenCurly, types_1.TokenType.CloseCurly)
        ];
        this.braceStacks = [new Stack(), new Stack(), new Stack()];
    }
    get count() {
        let c = 0;
        for (const s of this.braceStacks) {
            c += s.length;
        }
        return c;
    }
    isOpened(type) {
        for (let i = 0; i < this.bracePairs.length; i += 1) {
            const pair = this.bracePairs[i];
            if (pair.openBrace === type || pair.closeBrace === type) {
                return this.braceStacks[i].length > 0;
            }
        }
        return false;
    }
    countBrace(brace) {
        for (let i = 0; i < this.bracePairs.length; i += 1) {
            const pair = this.bracePairs[i];
            if (pair.openBrace === brace.type) {
                this.braceStacks[i].push(brace);
                return true;
            }
            if (pair.closeBrace === brace.type) {
                if (this.braceStacks[i].length > 0) {
                    this.braceStacks[i].pop();
                }
                return true;
            }
        }
        return false;
    }
}
exports.BraceCounter = BraceCounter;
//# sourceMappingURL=braceCounter.js.map