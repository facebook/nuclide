# -*- coding: utf-8 -*-
"""
This tokenizer has been copied from the ``tokenize.py`` standard library
tokenizer. The reason was simple: The standard library tokenizer fails
if the indentation is not right. To make it possible to do error recovery the
    tokenizer needed to be rewritten.

Basically this is a stripped down version of the standard library module, so
you can read the documentation there. Additionally we included some speed and
memory optimizations here.
"""
from __future__ import absolute_import

import sys
import string
import re
from collections import namedtuple
import itertools as _itertools
from codecs import BOM_UTF8

from parso.python.token import (tok_name, ENDMARKER, STRING, NUMBER, opmap,
                                NAME, ERRORTOKEN, NEWLINE, INDENT, DEDENT,
                                ERROR_DEDENT)
from parso._compatibility import py_version
from parso.utils import split_lines


TokenCollection = namedtuple(
    'TokenCollection',
    'pseudo_token single_quoted triple_quoted endpats always_break_tokens',
)

BOM_UTF8_STRING = BOM_UTF8.decode('utf-8')

_token_collection_cache = {}

if py_version >= 30:
    # Python 3 has str.isidentifier() to check if a char is a valid identifier
    is_identifier = str.isidentifier
else:
    namechars = string.ascii_letters + '_'
    is_identifier = lambda s: s in namechars


def group(*choices, **kwargs):
    capture = kwargs.pop('capture', False)  # Python 2, arrghhhhh :(
    assert not kwargs

    start = '('
    if not capture:
        start += '?:'
    return start + '|'.join(choices) + ')'


def any(*choices):
    return group(*choices) + '*'


def maybe(*choices):
    return group(*choices) + '?'


# Return the empty string, plus all of the valid string prefixes.
def _all_string_prefixes(version_info):
    def different_case_versions(prefix):
        for s in _itertools.product(*[(c, c.upper()) for c in prefix]):
            yield ''.join(s)
    # The valid string prefixes. Only contain the lower case versions,
    #  and don't contain any permuations (include 'fr', but not
    #  'rf'). The various permutations will be generated.
    _valid_string_prefixes = ['b', 'r', 'u']
    if version_info >= (3, 0):
        _valid_string_prefixes.append('br')

    if version_info >= (3, 6):
        _valid_string_prefixes += ['f', 'fr']

    # if we add binary f-strings, add: ['fb', 'fbr']
    result = set([''])
    for prefix in _valid_string_prefixes:
        for t in _itertools.permutations(prefix):
            # create a list with upper and lower versions of each
            #  character
            result.update(different_case_versions(t))
    if version_info <= (2, 7):
        # In Python 2 the order cannot just be random.
        result.update(different_case_versions('ur'))
        result.update(different_case_versions('br'))
    return result


def _compile(expr):
    return re.compile(expr, re.UNICODE)


def _get_token_collection(version_info):
    try:
        return _token_collection_cache[tuple(version_info)]
    except KeyError:
        _token_collection_cache[tuple(version_info)] = result = \
            _create_token_collection(version_info)
        return result


def _create_token_collection(version_info):
    # Note: we use unicode matching for names ("\w") but ascii matching for
    # number literals.
    Whitespace = r'[ \f\t]*'
    Comment = r'#[^\r\n]*'
    Name = r'\w+'

    if version_info >= (3, 6):
        Hexnumber = r'0[xX](?:_?[0-9a-fA-F])+'
        Binnumber = r'0[bB](?:_?[01])+'
        Octnumber = r'0[oO](?:_?[0-7])+'
        Decnumber = r'(?:0(?:_?0)*|[1-9](?:_?[0-9])*)'
        Intnumber = group(Hexnumber, Binnumber, Octnumber, Decnumber)
        Exponent = r'[eE][-+]?[0-9](?:_?[0-9])*'
        Pointfloat = group(r'[0-9](?:_?[0-9])*\.(?:[0-9](?:_?[0-9])*)?',
                           r'\.[0-9](?:_?[0-9])*') + maybe(Exponent)
        Expfloat = r'[0-9](?:_?[0-9])*' + Exponent
        Floatnumber = group(Pointfloat, Expfloat)
        Imagnumber = group(r'[0-9](?:_?[0-9])*[jJ]', Floatnumber + r'[jJ]')
    else:
        Hexnumber = r'0[xX][0-9a-fA-F]+'
        Binnumber = r'0[bB][01]+'
        if version_info >= (3, 0):
            Octnumber = r'0[oO][0-7]+'
        else:
            Octnumber = '0[oO]?[0-7]+'
        Decnumber = r'(?:0+|[1-9][0-9]*)'
        Intnumber = group(Hexnumber, Binnumber, Octnumber, Decnumber)
        Exponent = r'[eE][-+]?[0-9]+'
        Pointfloat = group(r'[0-9]+\.[0-9]*', r'\.[0-9]+') + maybe(Exponent)
        Expfloat = r'[0-9]+' + Exponent
        Floatnumber = group(Pointfloat, Expfloat)
        Imagnumber = group(r'[0-9]+[jJ]', Floatnumber + r'[jJ]')
    Number = group(Imagnumber, Floatnumber, Intnumber)

    # Note that since _all_string_prefixes includes the empty string,
    #  StringPrefix can be the empty string (making it optional).
    possible_prefixes = _all_string_prefixes(version_info)
    StringPrefix = group(*possible_prefixes)

    # Tail end of ' string.
    Single = r"[^'\\]*(?:\\.[^'\\]*)*'"
    # Tail end of " string.
    Double = r'[^"\\]*(?:\\.[^"\\]*)*"'
    # Tail end of ''' string.
    Single3 = r"[^'\\]*(?:(?:\\.|'(?!''))[^'\\]*)*'''"
    # Tail end of """ string.
    Double3 = r'[^"\\]*(?:(?:\\.|"(?!""))[^"\\]*)*"""'
    Triple = group(StringPrefix + "'''", StringPrefix + '"""')

    # Because of leftmost-then-longest match semantics, be sure to put the
    # longest operators first (e.g., if = came before ==, == would get
    # recognized as two instances of =).
    Operator = group(r"\*\*=?", r">>=?", r"<<=?", r"!=",
                     r"//=?", r"->",
                     r"[+\-*/%&@`|^=<>]=?",
                     r"~")

    Bracket = '[][(){}]'

    special_args = [r'\r?\n', r'[:;.,@]']
    if version_info >= (3, 0):
        special_args.insert(0, r'\.\.\.')
    Special = group(*special_args)

    Funny = group(Operator, Bracket, Special)

    # First (or only) line of ' or " string.
    ContStr = group(StringPrefix + r"'[^\n'\\]*(?:\\.[^\n'\\]*)*" +
                    group("'", r'\\\r?\n'),
                    StringPrefix + r'"[^\n"\\]*(?:\\.[^\n"\\]*)*' +
                    group('"', r'\\\r?\n'))
    PseudoExtras = group(r'\\\r?\n|\Z', Comment, Triple)
    PseudoToken = group(Whitespace, capture=True) + \
        group(PseudoExtras, Number, Funny, ContStr, Name, capture=True)

    # For a given string prefix plus quotes, endpats maps it to a regex
    #  to match the remainder of that string. _prefix can be empty, for
    #  a normal single or triple quoted string (with no prefix).
    endpats = {}
    for _prefix in possible_prefixes:
        endpats[_prefix + "'"] = _compile(Single)
        endpats[_prefix + '"'] = _compile(Double)
        endpats[_prefix + "'''"] = _compile(Single3)
        endpats[_prefix + '"""'] = _compile(Double3)

    # A set of all of the single and triple quoted string prefixes,
    #  including the opening quotes.
    single_quoted = set()
    triple_quoted = set()
    for t in possible_prefixes:
        for p in (t + '"', t + "'"):
            single_quoted.add(p)
        for p in (t + '"""', t + "'''"):
            triple_quoted.add(p)

    ALWAYS_BREAK_TOKENS = (';', 'import', 'class', 'def', 'try', 'except',
                           'finally', 'while', 'with', 'return')
    pseudo_token_compiled = _compile(PseudoToken)
    return TokenCollection(
        pseudo_token_compiled, single_quoted, triple_quoted, endpats,
        ALWAYS_BREAK_TOKENS
    )


class Token(namedtuple('Token', ['type', 'string', 'start_pos', 'prefix'])):
    @property
    def end_pos(self):
        lines = split_lines(self.string)
        if len(lines) > 1:
            return self.start_pos[0] + len(lines) - 1, 0
        else:
            return self.start_pos[0], self.start_pos[1] + len(self.string)


class PythonToken(Token):
    def _get_type_name(self, exact=True):
        return tok_name[self.type]

    def __repr__(self):
        return ('TokenInfo(type=%s, string=%r, start=%r, prefix=%r)' %
                self._replace(type=self._get_type_name()))


def tokenize(code, version_info, start_pos=(1, 0)):
    """Generate tokens from a the source code (string)."""
    lines = split_lines(code, keepends=True)
    return tokenize_lines(lines, version_info, start_pos=start_pos)


def tokenize_lines(lines, version_info, start_pos=(1, 0)):
    """
    A heavily modified Python standard library tokenizer.

    Additionally to the default information, yields also the prefix of each
    token. This idea comes from lib2to3. The prefix contains all information
    that is irrelevant for the parser like newlines in parentheses or comments.
    """
    pseudo_token, single_quoted, triple_quoted, endpats, always_break_tokens, = \
        _get_token_collection(version_info)
    paren_level = 0  # count parentheses
    indents = [0]
    max = 0
    numchars = '0123456789'
    contstr = ''
    contline = None
    # We start with a newline. This makes indent at the first position
    # possible. It's not valid Python, but still better than an INDENT in the
    # second line (and not in the first). This makes quite a few things in
    # Jedi's fast parser possible.
    new_line = True
    prefix = ''  # Should never be required, but here for safety
    additional_prefix = ''
    first = True
    lnum = start_pos[0] - 1
    for line in lines:  # loop over lines in stream
        lnum += 1
        pos = 0
        max = len(line)
        if first:
            if line.startswith(BOM_UTF8_STRING):
                additional_prefix = BOM_UTF8_STRING
                line = line[1:]
                max = len(line)

            # Fake that the part before was already parsed.
            line = '^' * start_pos[1] + line
            pos = start_pos[1]
            max += start_pos[1]

            first = False

        if contstr:                                         # continued string
            endmatch = endprog.match(line)
            if endmatch:
                pos = endmatch.end(0)
                yield PythonToken(STRING, contstr + line[:pos], contstr_start, prefix)
                contstr = ''
                contline = None
            else:
                contstr = contstr + line
                contline = contline + line
                continue

        while pos < max:
            pseudomatch = pseudo_token.match(line, pos)
            if not pseudomatch:                             # scan for tokens
                txt = line[pos:]
                if txt.endswith('\n'):
                    new_line = True
                yield PythonToken(ERRORTOKEN, txt, (lnum, pos), additional_prefix)
                additional_prefix = ''
                break

            prefix = additional_prefix + pseudomatch.group(1)
            additional_prefix = ''
            start, pos = pseudomatch.span(2)
            spos = (lnum, start)
            token = pseudomatch.group(2)
            if token == '':
                assert prefix
                additional_prefix = prefix
                # This means that we have a line with whitespace/comments at
                # the end, which just results in an endmarker.
                break
            initial = token[0]

            if new_line and initial not in '\r\n#':
                new_line = False
                if paren_level == 0:
                    i = 0
                    while line[i] == '\f':
                        i += 1
                        start -= 1
                    if start > indents[-1]:
                        yield PythonToken(INDENT, '', spos, '')
                        indents.append(start)
                    while start < indents[-1]:
                        if start > indents[-2]:
                            yield PythonToken(ERROR_DEDENT, '', (lnum, 0), '')
                            break
                        yield PythonToken(DEDENT, '', spos, '')
                        indents.pop()

            if (initial in numchars or                      # ordinary number
                    (initial == '.' and token != '.' and token != '...')):
                yield PythonToken(NUMBER, token, spos, prefix)
            elif initial in '\r\n':
                if not new_line and paren_level == 0:
                    yield PythonToken(NEWLINE, token, spos, prefix)
                else:
                    additional_prefix = prefix + token
                new_line = True
            elif initial == '#':  # Comments
                assert not token.endswith("\n")
                additional_prefix = prefix + token
            elif token in triple_quoted:
                endprog = endpats[token]
                endmatch = endprog.match(line, pos)
                if endmatch:                                # all on one line
                    pos = endmatch.end(0)
                    token = line[start:pos]
                    yield PythonToken(STRING, token, spos, prefix)
                else:
                    contstr_start = (lnum, start)           # multiple lines
                    contstr = line[start:]
                    contline = line
                    break
            elif initial in single_quoted or \
                    token[:2] in single_quoted or \
                    token[:3] in single_quoted:
                if token[-1] == '\n':                       # continued string
                    contstr_start = lnum, start
                    endprog = (endpats.get(initial) or endpats.get(token[1])
                               or endpats.get(token[2]))
                    contstr = line[start:]
                    contline = line
                    break
                else:                                       # ordinary string
                    yield PythonToken(STRING, token, spos, prefix)
            elif is_identifier(initial):                      # ordinary name
                if token in always_break_tokens:
                    paren_level = 0
                    while True:
                        indent = indents.pop()
                        if indent > start:
                            yield PythonToken(DEDENT, '', spos, '')
                        else:
                            indents.append(indent)
                            break
                yield PythonToken(NAME, token, spos, prefix)
            elif initial == '\\' and line[start:] in ('\\\n', '\\\r\n'):  # continued stmt
                additional_prefix += prefix + line[start:]
                break
            else:
                if token in '([{':
                    paren_level += 1
                elif token in ')]}':
                    paren_level -= 1

                try:
                    # This check is needed in any case to check if it's a valid
                    # operator or just some random unicode character.
                    typ = opmap[token]
                except KeyError:
                    typ = ERRORTOKEN
                yield PythonToken(typ, token, spos, prefix)

    if contstr:
        yield PythonToken(ERRORTOKEN, contstr, contstr_start, prefix)
        if contstr.endswith('\n'):
            new_line = True

    end_pos = lnum, max
    # As the last position we just take the maximally possible position. We
    # remove -1 for the last new line.
    for indent in indents[1:]:
        yield PythonToken(DEDENT, '', end_pos, '')
    yield PythonToken(ENDMARKER, '', end_pos, additional_prefix)


if __name__ == "__main__":
    if len(sys.argv) >= 2:
        path = sys.argv[1]
        with open(path) as f:
            code = f.read()
    else:
        code = sys.stdin.read()

    from parso.utils import python_bytes_to_unicode, parse_version_string

    if isinstance(code, bytes):
        code = python_bytes_to_unicode(code)

    for token in tokenize(code, parse_version_string()):
        print(token)
