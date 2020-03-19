import re

from itertools import count
from parso.utils import PythonVersionInfo
from parso.utils import split_lines
from parso.python.tokenize import Token
from parso import parser
from parso.tree import TypedLeaf, ErrorNode, ErrorLeaf

version36 = PythonVersionInfo(3, 6)


class TokenNamespace:
    _c = count()
    LBRACE = next(_c)
    RBRACE = next(_c)
    ENDMARKER = next(_c)
    COLON = next(_c)
    CONVERSION = next(_c)
    PYTHON_EXPR = next(_c)
    EXCLAMATION_MARK = next(_c)
    UNTERMINATED_STRING = next(_c)

    token_map = dict((v, k) for k, v in locals().items() if not k.startswith('_'))

    @classmethod
    def generate_token_id(cls, string):
        if string == '{':
            return cls.LBRACE
        elif string == '}':
            return cls.RBRACE
        elif string == '!':
            return cls.EXCLAMATION_MARK
        elif string == ':':
            return cls.COLON
        return getattr(cls, string)


GRAMMAR = """
fstring: expression* ENDMARKER
format_spec: ':' expression*
expression: '{' PYTHON_EXPR [ '!' CONVERSION ] [ format_spec ] '}'
"""

_prefix = r'((?:[^{}]+)*)'
_expr = _prefix + r'(\{|\}|$)'
_in_expr = r'([^{}\[\]:"\'!]*)(.?)'
# There's only one conversion character allowed. But the rules have to be
# checked later anyway, so allow more here. This makes error recovery nicer.
_conversion = r'([^={}:]*)(.?)'

_compiled_expr = re.compile(_expr)
_compiled_in_expr = re.compile(_in_expr)
_compiled_conversion = re.compile(_conversion)


def tokenize(code, start_pos=(1, 0)):
    def add_to_pos(string):
        lines = split_lines(string)
        l = len(lines[-1])
        if len(lines) > 1:
            start_pos[0] += len(lines) - 1
            start_pos[1] = l
        else:
            start_pos[1] += l

    def tok(value, type=None, prefix=''):
        if type is None:
            type = TokenNamespace.generate_token_id(value)

        add_to_pos(prefix)
        token = Token(type, value, tuple(start_pos), prefix)
        add_to_pos(value)
        return token

    start = 0
    recursion_level = 0
    added_prefix = ''
    start_pos = list(start_pos)
    while True:
        match = _compiled_expr.match(code, start)
        prefix = added_prefix + match.group(1)
        found = match.group(2)
        start = match.end()
        if not found:
            # We're at the end.
            break

        if found == '}':
            if recursion_level == 0 and len(code) > start  and code[start] == '}':
                # This is a }} escape.
                added_prefix = prefix + '}}'
                start += 1
                continue

            recursion_level = max(0, recursion_level - 1)
            yield tok(found, prefix=prefix)
            added_prefix = ''
        else:
            assert found == '{'
            if recursion_level == 0 and len(code) > start and code[start] == '{':
                # This is a {{ escape.
                added_prefix = prefix + '{{'
                start += 1
                continue

            recursion_level += 1
            yield tok(found, prefix=prefix)
            added_prefix = ''

            expression = ''
            squared_count = 0
            curly_count = 0
            while True:
                expr_match = _compiled_in_expr.match(code, start)
                expression += expr_match.group(1)
                found = expr_match.group(2)
                start = expr_match.end()

                if found == '{':
                    curly_count += 1
                    expression += found
                elif found == '}' and curly_count > 0:
                    curly_count -= 1
                    expression += found
                elif found == '[':
                    squared_count += 1
                    expression += found
                elif found == ']':
                    # Use a max function here, because the Python code might
                    # just have syntax errors.
                    squared_count = max(0, squared_count - 1)
                    expression += found
                elif found == ':' and (squared_count or curly_count):
                    expression += found
                elif found in ('"', "'"):
                    search = found
                    if len(code) > start + 1 and  \
                            code[start] == found == code[start+1]:
                        search *= 3
                        start += 2

                    index = code.find(search, start)
                    if index == -1:
                        yield tok(expression, type=TokenNamespace.PYTHON_EXPR)
                        yield tok(
                            found + code[start:],
                            type=TokenNamespace.UNTERMINATED_STRING,
                        )
                        start = len(code)
                        break
                    expression += found + code[start:index+1]
                    start = index + 1
                elif found == '!' and len(code) > start and code[start] == '=':
                    # This is a python `!=` and not a conversion.
                    expression += found
                else:
                    yield tok(expression, type=TokenNamespace.PYTHON_EXPR)
                    if found:
                        yield tok(found)
                    break

            if found == '!':
                conversion_match = _compiled_conversion.match(code, start)
                found = conversion_match.group(2)
                start = conversion_match.end()
                yield tok(conversion_match.group(1), type=TokenNamespace.CONVERSION)
                if found:
                    yield tok(found)
            if found == '}':
                recursion_level -= 1

            # We don't need to handle everything after ':', because that is
            # basically new tokens.

    yield tok('', type=TokenNamespace.ENDMARKER, prefix=prefix)


class Parser(parser.BaseParser):
    def parse(self, tokens):
        node = super(Parser, self).parse(tokens)
        if isinstance(node, self.default_leaf):  # Is an endmarker.
            # If there's no curly braces we get back a non-module. We always
            # want an fstring.
            node = self.default_node('fstring', [node])

        return node

    def convert_leaf(self, pgen_grammar, type, value, prefix, start_pos):
        # TODO this is so ugly.
        leaf_type = TokenNamespace.token_map[type].lower()
        return TypedLeaf(leaf_type, value, start_pos, prefix)

    def error_recovery(self, pgen_grammar, stack, arcs, typ, value, start_pos, prefix,
                       add_token_callback):
        if not self._error_recovery:
            return super(Parser, self).error_recovery(
                pgen_grammar, stack, arcs, typ, value, start_pos, prefix,
                add_token_callback
            )

        token_type = TokenNamespace.token_map[typ].lower()
        if len(stack) == 1:
            error_leaf = ErrorLeaf(token_type, value, start_pos, prefix)
            stack[0][2][1].append(error_leaf)
        else:
            dfa, state, (type_, nodes) = stack[1]
            stack[0][2][1].append(ErrorNode(nodes))
            stack[1:] = []

            add_token_callback(typ, value, start_pos, prefix)
