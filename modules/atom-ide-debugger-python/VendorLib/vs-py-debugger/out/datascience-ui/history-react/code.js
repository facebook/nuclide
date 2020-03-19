// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const Prism = require("prismjs");
const React = require("react");
const transforms_1 = require("./transforms");
// Borrowed this from the prism stuff. Simpler than trying to
// get loadLanguages to behave with webpack. Does mean we might get out of date though.
const pythonGrammar = {
    // tslint:disable-next-line:object-literal-key-quotes
    'comment': {
        pattern: /(^|[^\\])#.*/,
        lookbehind: true
    },
    // tslint:disable-next-line:object-literal-key-quotes
    'triple-quoted-string': {
        pattern: /("""|''')[\s\S]+?\1/,
        greedy: true,
        alias: 'string'
    },
    // tslint:disable-next-line:object-literal-key-quotes
    'string': {
        pattern: /("|')(?:\\.|(?!\1)[^\\\r\n])*\1/,
        greedy: true
    },
    // tslint:disable-next-line:object-literal-key-quotes
    'function': {
        pattern: /((?:^|\s)def[ \t]+)[a-zA-Z_]\w*(?=\s*\()/g,
        lookbehind: true
    },
    // tslint:disable-next-line:object-literal-key-quotes
    'class-name': {
        pattern: /(\bclass\s+)\w+/i,
        lookbehind: true
    },
    // tslint:disable-next-line:object-literal-key-quotes
    'keyword': /\b(?:as|assert|async|await|break|class|continue|def|del|elif|else|except|exec|finally|for|from|global|if|import|in|is|lambda|nonlocal|pass|print|raise|return|try|while|with|yield)\b/,
    // tslint:disable-next-line:object-literal-key-quotes
    'builtin': /\b(?:__import__|abs|all|any|apply|ascii|basestring|bin|bool|buffer|bytearray|bytes|callable|chr|classmethod|cmp|coerce|compile|complex|delattr|dict|dir|divmod|enumerate|eval|execfile|file|filter|float|format|frozenset|getattr|globals|hasattr|hash|help|hex|id|input|int|intern|isinstance|issubclass|iter|len|list|locals|long|map|max|memoryview|min|next|object|oct|open|ord|pow|property|range|raw_input|reduce|reload|repr|reversed|round|set|setattr|slice|sorted|staticmethod|str|sum|super|tuple|type|unichr|unicode|vars|xrange|zip)\b/,
    // tslint:disable-next-line:object-literal-key-quotes
    'boolean': /\b(?:True|False|None)\b/,
    // tslint:disable-next-line:object-literal-key-quotes
    'number': /(?:\b(?=\d)|\B(?=\.))(?:0[bo])?(?:(?:\d|0x[\da-f])[\da-f]*\.?\d*|\.\d+)(?:e[+-]?\d+)?j?\b/i,
    // tslint:disable-next-line:object-literal-key-quotes
    'operator': /[-+%=]=?|!=|\*\*?=?|\/\/?=?|<[<=>]?|>[=>]?|[&|^~]|\b(?:or|and|not)\b/,
    // tslint:disable-next-line:object-literal-key-quotes
    'punctuation': /[{}[\];(),.:]/
};
class Code extends React.Component {
    constructor(prop) {
        super(prop);
    }
    render() {
        const colorized = Prism.highlight(this.props.code, pythonGrammar);
        const Transform = transforms_1.transforms['text/html'];
        return (React.createElement("pre", null,
            React.createElement("code", { className: 'language-python' },
                React.createElement(Transform, { data: colorized }))));
    }
}
exports.Code = Code;
//# sourceMappingURL=code.js.map