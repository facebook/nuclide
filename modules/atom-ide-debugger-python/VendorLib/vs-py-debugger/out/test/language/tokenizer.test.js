// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const textRangeCollection_1 = require("../../client/language/textRangeCollection");
const tokenizer_1 = require("../../client/language/tokenizer");
const types_1 = require("../../client/language/types");
// tslint:disable-next-line:max-func-body-length
suite('Language.Tokenizer', () => {
    test('Empty', () => {
        const t = new tokenizer_1.Tokenizer();
        const tokens = t.tokenize('');
        assert.equal(tokens instanceof textRangeCollection_1.TextRangeCollection, true);
        assert.equal(tokens.count, 0);
        assert.equal(tokens.length, 0);
    });
    test('Strings: unclosed', () => {
        const t = new tokenizer_1.Tokenizer();
        const tokens = t.tokenize(' "string" """line1\n#line2"""\t\'un#closed');
        assert.equal(tokens.count, 3);
        const ranges = [1, 8, 10, 18, 29, 10];
        for (let i = 0; i < tokens.count; i += 1) {
            assert.equal(tokens.getItemAt(i).start, ranges[2 * i]);
            assert.equal(tokens.getItemAt(i).length, ranges[2 * i + 1]);
            assert.equal(tokens.getItemAt(i).type, types_1.TokenType.String);
        }
    });
    test('Strings: block next to regular, double-quoted', () => {
        const t = new tokenizer_1.Tokenizer();
        const tokens = t.tokenize('"string""""s2"""');
        assert.equal(tokens.count, 2);
        const ranges = [0, 8, 8, 8];
        for (let i = 0; i < tokens.count; i += 1) {
            assert.equal(tokens.getItemAt(i).start, ranges[2 * i]);
            assert.equal(tokens.getItemAt(i).length, ranges[2 * i + 1]);
            assert.equal(tokens.getItemAt(i).type, types_1.TokenType.String);
        }
    });
    test('Strings: block next to block, double-quoted', () => {
        const t = new tokenizer_1.Tokenizer();
        const tokens = t.tokenize('""""""""');
        assert.equal(tokens.count, 2);
        const ranges = [0, 6, 6, 2];
        for (let i = 0; i < tokens.count; i += 1) {
            assert.equal(tokens.getItemAt(i).start, ranges[2 * i]);
            assert.equal(tokens.getItemAt(i).length, ranges[2 * i + 1]);
            assert.equal(tokens.getItemAt(i).type, types_1.TokenType.String);
        }
    });
    test('Strings: unclosed sequence of quotes', () => {
        const t = new tokenizer_1.Tokenizer();
        const tokens = t.tokenize('"""""');
        assert.equal(tokens.count, 1);
        const ranges = [0, 5];
        for (let i = 0; i < tokens.count; i += 1) {
            assert.equal(tokens.getItemAt(i).start, ranges[2 * i]);
            assert.equal(tokens.getItemAt(i).length, ranges[2 * i + 1]);
            assert.equal(tokens.getItemAt(i).type, types_1.TokenType.String);
        }
    });
    test('Strings: single quote escape', () => {
        const t = new tokenizer_1.Tokenizer();
        // tslint:disable-next-line:quotemark
        const tokens = t.tokenize("'\\'quoted\\''");
        assert.equal(tokens.count, 1);
        assert.equal(tokens.getItemAt(0).type, types_1.TokenType.String);
        assert.equal(tokens.getItemAt(0).length, 12);
    });
    test('Strings: double quote escape', () => {
        const t = new tokenizer_1.Tokenizer();
        const tokens = t.tokenize('"\\"quoted\\""');
        assert.equal(tokens.count, 1);
        assert.equal(tokens.getItemAt(0).type, types_1.TokenType.String);
        assert.equal(tokens.getItemAt(0).length, 12);
    });
    test('Strings: single quoted f-string ', () => {
        const t = new tokenizer_1.Tokenizer();
        // tslint:disable-next-line:quotemark
        const tokens = t.tokenize("a+f'quoted'");
        assert.equal(tokens.count, 3);
        assert.equal(tokens.getItemAt(0).type, types_1.TokenType.Identifier);
        assert.equal(tokens.getItemAt(1).type, types_1.TokenType.Operator);
        assert.equal(tokens.getItemAt(2).type, types_1.TokenType.String);
        assert.equal(tokens.getItemAt(2).length, 9);
    });
    test('Strings: double quoted f-string ', () => {
        const t = new tokenizer_1.Tokenizer();
        const tokens = t.tokenize('x(1,f"quoted")');
        assert.equal(tokens.count, 6);
        assert.equal(tokens.getItemAt(0).type, types_1.TokenType.Identifier);
        assert.equal(tokens.getItemAt(1).type, types_1.TokenType.OpenBrace);
        assert.equal(tokens.getItemAt(2).type, types_1.TokenType.Number);
        assert.equal(tokens.getItemAt(3).type, types_1.TokenType.Comma);
        assert.equal(tokens.getItemAt(4).type, types_1.TokenType.String);
        assert.equal(tokens.getItemAt(4).length, 9);
        assert.equal(tokens.getItemAt(5).type, types_1.TokenType.CloseBrace);
    });
    test('Strings: single quoted multiline f-string ', () => {
        const t = new tokenizer_1.Tokenizer();
        // tslint:disable-next-line:quotemark
        const tokens = t.tokenize("f'''quoted'''");
        assert.equal(tokens.count, 1);
        assert.equal(tokens.getItemAt(0).type, types_1.TokenType.String);
        assert.equal(tokens.getItemAt(0).length, 13);
    });
    test('Strings: double quoted multiline f-string ', () => {
        const t = new tokenizer_1.Tokenizer();
        const tokens = t.tokenize('f"""quoted """');
        assert.equal(tokens.count, 1);
        assert.equal(tokens.getItemAt(0).type, types_1.TokenType.String);
        assert.equal(tokens.getItemAt(0).length, 14);
    });
    test('Strings: escape at the end of single quoted string ', () => {
        const t = new tokenizer_1.Tokenizer();
        // tslint:disable-next-line:quotemark
        const tokens = t.tokenize("'quoted\\'\nx");
        assert.equal(tokens.count, 2);
        assert.equal(tokens.getItemAt(0).type, types_1.TokenType.String);
        assert.equal(tokens.getItemAt(0).length, 9);
        assert.equal(tokens.getItemAt(1).type, types_1.TokenType.Identifier);
    });
    test('Strings: escape at the end of double quoted string ', () => {
        const t = new tokenizer_1.Tokenizer();
        const tokens = t.tokenize('"quoted\\"\nx');
        assert.equal(tokens.count, 2);
        assert.equal(tokens.getItemAt(0).type, types_1.TokenType.String);
        assert.equal(tokens.getItemAt(0).length, 9);
        assert.equal(tokens.getItemAt(1).type, types_1.TokenType.Identifier);
    });
    test('Strings: b/u/r-string', () => {
        const t = new tokenizer_1.Tokenizer();
        const tokens = t.tokenize('b"b" u"u" br"br" ur"ur"');
        assert.equal(tokens.count, 4);
        assert.equal(tokens.getItemAt(0).type, types_1.TokenType.String);
        assert.equal(tokens.getItemAt(0).length, 4);
        assert.equal(tokens.getItemAt(1).type, types_1.TokenType.String);
        assert.equal(tokens.getItemAt(1).length, 4);
        assert.equal(tokens.getItemAt(2).type, types_1.TokenType.String);
        assert.equal(tokens.getItemAt(2).length, 6);
        assert.equal(tokens.getItemAt(3).type, types_1.TokenType.String);
        assert.equal(tokens.getItemAt(3).length, 6);
    });
    test('Strings: escape at the end of double quoted string ', () => {
        const t = new tokenizer_1.Tokenizer();
        const tokens = t.tokenize('"quoted\\"\nx');
        assert.equal(tokens.count, 2);
        assert.equal(tokens.getItemAt(0).type, types_1.TokenType.String);
        assert.equal(tokens.getItemAt(0).length, 9);
        assert.equal(tokens.getItemAt(1).type, types_1.TokenType.Identifier);
    });
    test('Comments', () => {
        const t = new tokenizer_1.Tokenizer();
        const tokens = t.tokenize(' #co"""mment1\n\t\n#comm\'ent2 ');
        assert.equal(tokens.count, 2);
        const ranges = [1, 12, 15, 11];
        for (let i = 0; i < ranges.length / 2; i += 2) {
            assert.equal(tokens.getItemAt(i).start, ranges[i]);
            assert.equal(tokens.getItemAt(i).length, ranges[i + 1]);
            assert.equal(tokens.getItemAt(i).type, types_1.TokenType.Comment);
        }
    });
    test('Period to operator token', () => {
        const t = new tokenizer_1.Tokenizer();
        const tokens = t.tokenize('x.y');
        assert.equal(tokens.count, 3);
        assert.equal(tokens.getItemAt(0).type, types_1.TokenType.Identifier);
        assert.equal(tokens.getItemAt(1).type, types_1.TokenType.Operator);
        assert.equal(tokens.getItemAt(2).type, types_1.TokenType.Identifier);
    });
    test('@ to operator token', () => {
        const t = new tokenizer_1.Tokenizer();
        const tokens = t.tokenize('@x');
        assert.equal(tokens.count, 2);
        assert.equal(tokens.getItemAt(0).type, types_1.TokenType.Operator);
        assert.equal(tokens.getItemAt(1).type, types_1.TokenType.Identifier);
    });
    test('Unknown token', () => {
        const t = new tokenizer_1.Tokenizer();
        const tokens = t.tokenize('`$');
        assert.equal(tokens.count, 1);
        assert.equal(tokens.getItemAt(0).type, types_1.TokenType.Unknown);
    });
    test('Hex number', () => {
        const t = new tokenizer_1.Tokenizer();
        const tokens = t.tokenize('1 0X2 0x3 0x');
        assert.equal(tokens.count, 5);
        assert.equal(tokens.getItemAt(0).type, types_1.TokenType.Number);
        assert.equal(tokens.getItemAt(0).length, 1);
        assert.equal(tokens.getItemAt(1).type, types_1.TokenType.Number);
        assert.equal(tokens.getItemAt(1).length, 3);
        assert.equal(tokens.getItemAt(2).type, types_1.TokenType.Number);
        assert.equal(tokens.getItemAt(2).length, 3);
        assert.equal(tokens.getItemAt(3).type, types_1.TokenType.Number);
        assert.equal(tokens.getItemAt(3).length, 1);
        assert.equal(tokens.getItemAt(4).type, types_1.TokenType.Identifier);
        assert.equal(tokens.getItemAt(4).length, 1);
    });
    test('Binary number', () => {
        const t = new tokenizer_1.Tokenizer();
        const tokens = t.tokenize('1 0B1 0b010 0b3 0b');
        assert.equal(tokens.count, 7);
        assert.equal(tokens.getItemAt(0).type, types_1.TokenType.Number);
        assert.equal(tokens.getItemAt(0).length, 1);
        assert.equal(tokens.getItemAt(1).type, types_1.TokenType.Number);
        assert.equal(tokens.getItemAt(1).length, 3);
        assert.equal(tokens.getItemAt(2).type, types_1.TokenType.Number);
        assert.equal(tokens.getItemAt(2).length, 5);
        assert.equal(tokens.getItemAt(3).type, types_1.TokenType.Number);
        assert.equal(tokens.getItemAt(3).length, 1);
        assert.equal(tokens.getItemAt(4).type, types_1.TokenType.Identifier);
        assert.equal(tokens.getItemAt(4).length, 2);
        assert.equal(tokens.getItemAt(5).type, types_1.TokenType.Number);
        assert.equal(tokens.getItemAt(5).length, 1);
        assert.equal(tokens.getItemAt(6).type, types_1.TokenType.Identifier);
        assert.equal(tokens.getItemAt(6).length, 1);
    });
    test('Octal number', () => {
        const t = new tokenizer_1.Tokenizer();
        const tokens = t.tokenize('1 0o4 0o077 -0o200 0o9 0oO');
        assert.equal(tokens.count, 8);
        assert.equal(tokens.getItemAt(0).type, types_1.TokenType.Number);
        assert.equal(tokens.getItemAt(0).length, 1);
        assert.equal(tokens.getItemAt(1).type, types_1.TokenType.Number);
        assert.equal(tokens.getItemAt(1).length, 3);
        assert.equal(tokens.getItemAt(2).type, types_1.TokenType.Number);
        assert.equal(tokens.getItemAt(2).length, 5);
        assert.equal(tokens.getItemAt(3).type, types_1.TokenType.Number);
        assert.equal(tokens.getItemAt(3).length, 6);
        assert.equal(tokens.getItemAt(4).type, types_1.TokenType.Number);
        assert.equal(tokens.getItemAt(4).length, 1);
        assert.equal(tokens.getItemAt(5).type, types_1.TokenType.Identifier);
        assert.equal(tokens.getItemAt(5).length, 2);
        assert.equal(tokens.getItemAt(6).type, types_1.TokenType.Number);
        assert.equal(tokens.getItemAt(6).length, 1);
        assert.equal(tokens.getItemAt(7).type, types_1.TokenType.Identifier);
        assert.equal(tokens.getItemAt(7).length, 2);
    });
    test('Decimal number', () => {
        const t = new tokenizer_1.Tokenizer();
        const tokens = t.tokenize('-2147483647 ++2147483647');
        assert.equal(tokens.count, 3);
        assert.equal(tokens.getItemAt(0).type, types_1.TokenType.Number);
        assert.equal(tokens.getItemAt(0).length, 11);
        assert.equal(tokens.getItemAt(1).type, types_1.TokenType.Operator);
        assert.equal(tokens.getItemAt(1).length, 1);
        assert.equal(tokens.getItemAt(2).type, types_1.TokenType.Number);
        assert.equal(tokens.getItemAt(2).length, 11);
    });
    test('Decimal number operator', () => {
        const t = new tokenizer_1.Tokenizer();
        const tokens = t.tokenize('a[: -1]');
        assert.equal(tokens.count, 5);
        assert.equal(tokens.getItemAt(3).type, types_1.TokenType.Number);
        assert.equal(tokens.getItemAt(3).length, 2);
    });
    test('Floating point number', () => {
        const t = new tokenizer_1.Tokenizer();
        const tokens = t.tokenize('3.0 .2 ++.3e+12 --.4e1');
        assert.equal(tokens.count, 6);
        assert.equal(tokens.getItemAt(0).type, types_1.TokenType.Number);
        assert.equal(tokens.getItemAt(0).length, 3);
        assert.equal(tokens.getItemAt(1).type, types_1.TokenType.Number);
        assert.equal(tokens.getItemAt(1).length, 2);
        assert.equal(tokens.getItemAt(2).type, types_1.TokenType.Operator);
        assert.equal(tokens.getItemAt(2).length, 1);
        assert.equal(tokens.getItemAt(3).type, types_1.TokenType.Number);
        assert.equal(tokens.getItemAt(3).length, 7);
        assert.equal(tokens.getItemAt(4).type, types_1.TokenType.Operator);
        assert.equal(tokens.getItemAt(4).length, 1);
        assert.equal(tokens.getItemAt(5).type, types_1.TokenType.Number);
        assert.equal(tokens.getItemAt(5).length, 5);
    });
    test('Floating point numbers with braces', () => {
        const t = new tokenizer_1.Tokenizer();
        const tokens = t.tokenize('(3.0) (.2) (+.3e+12, .4e1; 0)');
        assert.equal(tokens.count, 13);
        assert.equal(tokens.getItemAt(1).type, types_1.TokenType.Number);
        assert.equal(tokens.getItemAt(1).length, 3);
        assert.equal(tokens.getItemAt(4).type, types_1.TokenType.Number);
        assert.equal(tokens.getItemAt(4).length, 2);
        assert.equal(tokens.getItemAt(7).type, types_1.TokenType.Number);
        assert.equal(tokens.getItemAt(7).length, 7);
        assert.equal(tokens.getItemAt(9).type, types_1.TokenType.Number);
        assert.equal(tokens.getItemAt(9).length, 4);
        assert.equal(tokens.getItemAt(11).type, types_1.TokenType.Number);
        assert.equal(tokens.getItemAt(11).length, 1);
    });
    test('Underscore numbers', () => {
        const t = new tokenizer_1.Tokenizer();
        const tokens = t.tokenize('+1_0_0_0 0_0 .5_00_3e-4 0xCAFE_F00D 10_000_000.0 0b_0011_1111_0100_1110');
        const lengths = [8, 3, 10, 11, 12, 22];
        assert.equal(tokens.count, 6);
        for (let i = 0; i < tokens.count; i += 1) {
            assert.equal(tokens.getItemAt(i).type, types_1.TokenType.Number);
            assert.equal(tokens.getItemAt(i).length, lengths[i]);
        }
    });
    test('Simple expression, leading minus', () => {
        const t = new tokenizer_1.Tokenizer();
        const tokens = t.tokenize('x == -y');
        assert.equal(tokens.count, 4);
        assert.equal(tokens.getItemAt(0).type, types_1.TokenType.Identifier);
        assert.equal(tokens.getItemAt(0).length, 1);
        assert.equal(tokens.getItemAt(1).type, types_1.TokenType.Operator);
        assert.equal(tokens.getItemAt(1).length, 2);
        assert.equal(tokens.getItemAt(2).type, types_1.TokenType.Operator);
        assert.equal(tokens.getItemAt(2).length, 1);
        assert.equal(tokens.getItemAt(3).type, types_1.TokenType.Identifier);
        assert.equal(tokens.getItemAt(3).length, 1);
    });
    test('Operators', () => {
        const text = '< <> << <<= ' +
            '== != > >> >>= >= <=' +
            '+ - ~ %' +
            '* ** / /= //=' +
            '*= += -= ~= %= **= ' +
            '& &= | |= ^ ^= ->';
        const tokens = new tokenizer_1.Tokenizer().tokenize(text);
        const lengths = [
            1, 2, 2, 3,
            2, 2, 1, 2, 3, 2, 2,
            1, 1, 1, 1,
            1, 2, 1, 2, 3,
            2, 2, 2, 2, 2, 3,
            1, 2, 1, 2, 1, 2, 2
        ];
        assert.equal(tokens.count, lengths.length);
        for (let i = 0; i < tokens.count; i += 1) {
            const t = tokens.getItemAt(i);
            assert.equal(t.type, types_1.TokenType.Operator, `${t.type} at ${i} is not an operator`);
            assert.equal(t.length, lengths[i], `Length ${t.length} at ${i} (text ${text.substr(t.start, t.length)}), expected ${lengths[i]}`);
        }
    });
});
//# sourceMappingURL=tokenizer.test.js.map