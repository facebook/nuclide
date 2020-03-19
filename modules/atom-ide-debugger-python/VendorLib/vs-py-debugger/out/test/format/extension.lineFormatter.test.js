"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const TypeMoq = require("typemoq");
const vscode_1 = require("vscode");
require("../../client/common/extensions");
const lineFormatter_1 = require("../../client/formatters/lineFormatter");
const formatFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'formatting');
const grammarFile = path.join(formatFilesPath, 'pythonGrammar.py');
// https://www.python.org/dev/peps/pep-0008/#code-lay-out
// tslint:disable-next-line:max-func-body-length
suite('Formatting - line formatter', () => {
    const formatter = new lineFormatter_1.LineFormatter();
    test('Operator spacing', () => {
        testFormatLine('( x  +1 )*y/ 3', '(x + 1) * y / 3');
    });
    test('Braces spacing', () => {
        testFormatMultiline('foo =(0 ,)', 0, 'foo = (0,)');
    });
    test('Colon regular', () => {
        testFormatMultiline('if x == 4 : print x,y; x,y= y, x', 0, 'if x == 4: print x, y; x, y = y, x');
    });
    test('Colon slices', () => {
        testFormatLine('x[1: 30]', 'x[1:30]');
    });
    test('Colon slices in arguments', () => {
        testFormatLine('spam ( ham[ 1 :3], {eggs : 2})', 'spam(ham[1:3], {eggs: 2})');
    });
    test('Colon slices with double colon', () => {
        testFormatLine('ham [1:9 ], ham[ 1: 9:   3], ham[: 9 :3], ham[1: :3], ham [ 1: 9:]', 'ham[1:9], ham[1:9:3], ham[:9:3], ham[1::3], ham[1:9:]');
    });
    test('Colon slices with operators', () => {
        testFormatLine('ham [lower+ offset :upper+offset]', 'ham[lower + offset:upper + offset]');
    });
    test('Colon slices with functions', () => {
        testFormatLine('ham[ : upper_fn ( x) : step_fn(x )], ham[ :: step_fn(x)]', 'ham[:upper_fn(x):step_fn(x)], ham[::step_fn(x)]');
    });
    test('Colon in for loop', () => {
        testFormatLine('for index in  range( len(fruits) ): ', 'for index in range(len(fruits)):');
    });
    test('Nested braces', () => {
        testFormatLine('[ 1 :[2: (x,),y]]{1}', '[1:[2:(x,), y]]{1}');
    });
    test('Trailing comment', () => {
        testFormatMultiline('x=1    # comment', 0, 'x = 1  # comment');
    });
    test('Single comment', () => {
        testFormatLine('# comment', '# comment');
    });
    test('Comment with leading whitespace', () => {
        testFormatLine('   # comment', '   # comment');
    });
    test('Operators without following space', () => {
        testFormatLine('foo( *a, ** b, ! c)', 'foo(*a, **b, !c)');
    });
    test('Brace after keyword', () => {
        testFormatLine('for x in(1,2,3)', 'for x in (1, 2, 3)');
        testFormatLine('assert(1,2,3)', 'assert (1, 2, 3)');
        testFormatLine('if (True|False)and(False/True)not (! x )', 'if (True | False) and (False / True) not (!x)');
        testFormatLine('while (True|False)', 'while (True | False)');
        testFormatLine('yield(a%b)', 'yield (a % b)');
    });
    test('Dot operator', () => {
        testFormatLine('x.y', 'x.y');
        testFormatLine('5 .y', '5.y');
    });
    test('Unknown tokens no space', () => {
        testFormatLine('abc\\n\\', 'abc\\n\\');
    });
    test('Unknown tokens with space', () => {
        testFormatLine('abc \\n \\', 'abc \\n \\');
    });
    test('Double asterisk', () => {
        testFormatLine('a**2, ** k', 'a ** 2, **k');
    });
    test('Lambda', () => {
        testFormatLine('lambda * args, :0', 'lambda *args,: 0');
    });
    test('Comma expression', () => {
        testFormatMultiline('x=1,2,3', 0, 'x = 1, 2, 3');
    });
    test('is exression', () => {
        testFormatLine('a( (False is  2)  is 3)', 'a((False is 2) is 3)');
    });
    test('Function returning tuple', () => {
        testFormatMultiline('x,y=f(a)', 0, 'x, y = f(a)');
    });
    test('from. import A', () => {
        testFormatLine('from. import A', 'from . import A');
    });
    test('from .. import', () => {
        testFormatLine('from ..import', 'from .. import');
    });
    test('from..x import', () => {
        testFormatLine('from..x import', 'from ..x import');
    });
    test('Raw strings', () => {
        testFormatMultiline('z=r""', 0, 'z = r""');
        testFormatMultiline('z=rf""', 0, 'z = rf""');
        testFormatMultiline('z=R""', 0, 'z = R""');
        testFormatMultiline('z=RF""', 0, 'z = RF""');
    });
    test('Binary @', () => {
        testFormatLine('a@  b', 'a @ b');
    });
    test('Unary operators', () => {
        testFormatMultiline('x= - y', 0, 'x = -y');
        testFormatMultiline('x= + y', 0, 'x = +y');
        testFormatMultiline('x= ~ y', 0, 'x = ~y');
        testFormatMultiline('x=-1', 0, 'x = -1');
        testFormatMultiline('x=   +1', 0, 'x = +1');
        testFormatMultiline('x=  ~1 ', 0, 'x = ~1');
    });
    test('Equals with type hints', () => {
        testFormatMultiline('def foo(x:int=3,x=100.)', 0, 'def foo(x: int = 3, x=100.)');
    });
    test('Trailing comma', () => {
        testFormatLine('a, =[1]', 'a, = [1]');
    });
    test('if()', () => {
        testFormatLine('if(True) :', 'if (True):');
    });
    test('lambda arguments', () => {
        testFormatMultiline('l4= lambda x =lambda y =lambda z= 1: z: y(): x()', 0, 'l4 = lambda x=lambda y=lambda z=1: z: y(): x()');
    });
    test('star in multiline arguments', () => {
        testFormatMultiline('x = [\n  * param1,\n  * param2\n]', 1, '  *param1,');
        testFormatMultiline('x = [\n  * param1,\n  * param2\n]', 2, '  *param2');
    });
    test('arrow operator', () => {
        //testFormatMultiline('def f(a, b: 1, e: 3 = 4, f =5, * g: 6, ** k: 11) -> 12: pass', 0, 'def f(a, b: 1, e: 3 = 4, f=5, *g: 6, **k: 11) -> 12: pass');
        testFormatMultiline('def f(a, \n    ** k: 11) -> 12: pass', 1, '    **k: 11) -> 12: pass');
    });
    test('Multiline function call', () => {
        testFormatMultiline('def foo(x = 1)', 0, 'def foo(x=1)');
        testFormatMultiline('def foo(a\n, x = 1)', 1, ', x=1)');
        testFormatMultiline('foo(a  ,b,\n  x = 1)', 1, '  x=1)');
        testFormatMultiline('if True:\n  if False:\n    foo(a  , bar(\n      x = 1)', 3, '      x=1)');
        testFormatMultiline('z=foo (0 , x= 1, (3+7) , y , z )', 0, 'z = foo(0, x=1, (3 + 7), y, z)');
        testFormatMultiline('foo (0,\n x= 1,', 1, ' x=1,');
        testFormatMultiline(
        // tslint:disable-next-line:no-multiline-string
        `async def fetch():
  async with aiohttp.ClientSession() as session:
    async with session.ws_connect(
        "http://127.0.0.1:8000/", headers = cookie) as ws: # add unwanted spaces`, 3, '        "http://127.0.0.1:8000/", headers=cookie) as ws:  # add unwanted spaces');
        testFormatMultiline('def pos0key1(*, key): return key\npos0key1(key= 100)', 1, 'pos0key1(key=100)');
        testFormatMultiline('def test_string_literals(self):\n  x= 1; y =2; self.assertTrue(len(x) == 0 and x == y)', 1, '  x = 1; y = 2; self.assertTrue(len(x) == 0 and x == y)');
    });
    test('Grammar file', () => {
        const content = fs.readFileSync(grammarFile).toString('utf8');
        const lines = content.splitLines({ trim: false, removeEmptyEntries: false });
        for (let i = 0; i < lines.length; i += 1) {
            const line = lines[i];
            const actual = formatMultiline(content, i);
            assert.equal(actual, line, `Line ${i + 1} changed: '${line.trim()}' to '${actual.trim()}'`);
        }
    });
    function testFormatLine(text, expected) {
        const actual = formatLine(text);
        assert.equal(actual, expected);
    }
    function testFormatMultiline(content, lineNumber, expected) {
        const actual = formatMultiline(content, lineNumber);
        assert.equal(actual, expected);
    }
    function formatMultiline(content, lineNumber) {
        const lines = content.splitLines({ trim: false, removeEmptyEntries: false });
        const document = TypeMoq.Mock.ofType();
        document.setup(x => x.lineAt(TypeMoq.It.isAnyNumber())).returns(n => {
            const line = TypeMoq.Mock.ofType();
            line.setup(x => x.text).returns(() => lines[n]);
            line.setup(x => x.range).returns(() => new vscode_1.Range(new vscode_1.Position(n, 0), new vscode_1.Position(n, lines[n].length)));
            return line.object;
        });
        document.setup(x => x.getText(TypeMoq.It.isAny())).returns(o => {
            const r = o;
            const bits = [];
            if (r.start.line === r.end.line) {
                return lines[r.start.line].substring(r.start.character, r.end.character);
            }
            bits.push(lines[r.start.line].substr(r.start.character));
            for (let i = r.start.line + 1; i < r.end.line; i += 1) {
                bits.push(lines[i]);
            }
            bits.push(lines[r.end.line].substring(0, r.end.character));
            return bits.join('\n');
        });
        document.setup(x => x.offsetAt(TypeMoq.It.isAny())).returns(o => {
            const p = o;
            let offset = 0;
            for (let i = 0; i < p.line; i += 1) {
                offset += lines[i].length + 1; // Accounting for the line break
            }
            return offset + p.character;
        });
        return formatter.formatLine(document.object, lineNumber);
    }
    function formatLine(text) {
        const line = TypeMoq.Mock.ofType();
        line.setup(x => x.text).returns(() => text);
        const document = TypeMoq.Mock.ofType();
        document.setup(x => x.lineAt(TypeMoq.It.isAnyNumber())).returns(() => line.object);
        return formatter.formatLine(document.object, 0);
    }
});
//# sourceMappingURL=extension.lineFormatter.test.js.map