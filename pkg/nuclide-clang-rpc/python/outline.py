#!/usr/bin/env python

# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

from __future__ import print_function

from clang.cindex import Cursor, CursorKind, TokenKind
from utils import range_dict_relative

import ctypes
import itertools
import re

# Function/method cursor kinds.
FUNCTION_KINDS = set([
    'FUNCTION_DECL',
    'FUNCTION_TEMPLATE',
    'CXX_METHOD',
    'CONSTRUCTOR',
    'DESTRUCTOR',
    'OBJC_INSTANCE_METHOD_DECL',
    'OBJC_CLASS_METHOD_DECL',
])

# Class-like cursors.
CLASS_KINDS = set([
    'STRUCT_DECL',
    'UNION_DECL',
    'CLASS_DECL',
    'ENUM_DECL',
    'OBJC_INTERFACE_DECL',
    'OBJC_CATEGORY_DECL',
    'OBJC_PROTOCOL_DECL',
    'OBJC_IMPLEMENTATION_DECL',
    'OBJC_CATEGORY_IMPL_DECL',
    'CLASS_TEMPLATE',
    'CLASS_TEMPLATE_PARTIAL_SPECIALIZATION',
    'NAMESPACE',
])

# (Possibly external) members of CLASS_KINDS.
MEMBER_KINDS = set([
    'CXX_METHOD',
    'CONSTRUCTOR',
    'DESTRUCTOR',
    'FIELD_DECL',
    'VAR_DECL',
    'ENUM_CONSTANT_DECL',
])

# Variables and fields.
VAR_KINDS = set([
    'OBJC_IVAR_DECL',
    'FIELD_DECL',
    'VAR_DECL',
])

# Capture the ubiquitous GTest-style TEST/TEST_F macros.
GTEST_MACROS = set(['TEST', 'TEST_F'])
MACRO_INSTANTIATION = 'MACRO_INSTANTIATION'

OTHER_KINDS = set([
    MACRO_INSTANTIATION,
])

# Record any of the cursor types listed above.
ALL_KINDS = FUNCTION_KINDS | CLASS_KINDS | MEMBER_KINDS | VAR_KINDS | OTHER_KINDS


# People like adding a '-' by convention, but strip that out.
PRAGMA_MARK_REGEX = re.compile(
    '^[ \t]*(?:#[ \t]*pragma[ \t]+mark[ \t]+|\/\/+[ \t]*MARK:[ \t]*)(?:-[ \t]*)?(.+)$',
    re.MULTILINE)


def visit_cursor(libclang, cursor):
    try:
        kind = cursor.kind.name
    except:
        # Some cursor kinds aren't supported by the Python binding.
        return None
    if kind not in ALL_KINDS:
        return None

    # Skip symbols from other files.
    if not libclang.clang_Location_isFromMainFile(cursor.location):
        return None

    # Names of function parameters.
    params = None
    # Names of template parameters.
    tparams = None
    children = None
    name = cursor.spelling
    # Display types for variables and typedefs.
    cursor_type = cursor.type.spelling if kind in VAR_KINDS else None
    if kind in FUNCTION_KINDS:
        # We can't use displayname as it also includes the arguments.
        params = []
        tparams = []
        for child in cursor.get_children():
            if child.kind == CursorKind.PARM_DECL:
                # Use the param name, but fall back to the raw type if unnamed.
                params.append(child.spelling or child.type.spelling)
            elif child.kind == CursorKind.TEMPLATE_TYPE_PARAMETER:
                tparams.append(child.spelling)
            # TODO(hansonw): non-type and "template template" params?

    if kind in MEMBER_KINDS:
        # Name should be fully qualified if outside the parent.
        if cursor.semantic_parent != cursor.lexical_parent:
            name = cursor.semantic_parent.spelling + '::' + name
    elif kind in CLASS_KINDS:
        # Include template information.
        name = cursor.displayname
        children = []
        if kind == 'OBJC_CATEGORY_DECL':
            # Fix for T24363204, ref. http://lists.llvm.org/pipermail/cfe-dev/2014-November/039961.html
            for child in cursor.get_children():
                try:
                    if child.kind.name == 'OBJC_CLASS_REF':
                        name = '{} ({})'.format(child.displayname, name)
                        break
                except:
                    pass
        for child in cursor.get_children():
            child_outline = visit_cursor(libclang, child)
            if child_outline is not None:
                children.append(child_outline)

    if kind == MACRO_INSTANTIATION:
        params = []
        if name in GTEST_MACROS:
            # Should look like TEST(id, id).
            tokens = list(itertools.islice(cursor.get_tokens(), 1, 6))
            if len(tokens) == 5 and (
                tokens[0].kind == TokenKind.PUNCTUATION and
                tokens[1].kind == TokenKind.IDENTIFIER and
                tokens[2].kind == TokenKind.PUNCTUATION and
                tokens[3].kind == TokenKind.IDENTIFIER and
                tokens[4].kind == TokenKind.PUNCTUATION
            ):
                params = [tokens[1].spelling, tokens[3].spelling]
            else:
                return None
        else:
            # TODO(hansonw): Handle other special macros like DEFINE_ params.
            return None

    ret = {
        'name': name,
        'cursor_kind': kind,
        'cursor_type': cursor_type,
        'extent': range_dict_relative(cursor.extent),
        'params': params,
        'tparams': tparams,
        'children': children,
    }
    return {k: v for k, v in ret.items() if v is not None}


# Scan through the outline tree and insert pragma marks as we pass by them.
def insert_pragma_marks(marks, outline_tree, tree_end=None):
    new_result = []
    for node in outline_tree:
        while len(marks) > 0:
            if marks[-1]['extent']['start']['row'] > node['extent']['start']['row']:
                break
            new_result.append(marks.pop())
        children = node.get('children')
        if children:
            children[:] = insert_pragma_marks(marks, children, node['extent']['end']['row'])
        new_result.append(node)

    # Consume all remaining marks included in this subtree.
    while len(marks) > 0:
        if tree_end is not None and marks[-1]['extent']['start']['row'] > tree_end:
            break
        new_result.append(marks.pop())

    return new_result


def get_outline(libclang, translation_unit, contents):
    root_cursor = translation_unit.cursor

    # This is the same as Cursor.get_children minus an assert in visitor().
    # This results in a ~2x speedup!
    callback_type = ctypes.CFUNCTYPE(ctypes.c_int, Cursor, Cursor, ctypes.py_object)

    def visitor(child, parent, result):
        child._tu = translation_unit
        child_outline = visit_cursor(libclang, child)
        if child_outline is not None:
            result.append(child_outline)
        return 1  # continue

    result = []
    libclang.clang_visitChildren(root_cursor, callback_type(visitor), result)

    # Look for pragma marks. These are not detectable in the AST.
    line = 0
    lastpos = 0
    pragma_marks = []
    for mark in PRAGMA_MARK_REGEX.finditer(contents):
        while lastpos < mark.start():
            if contents[lastpos] == '\n':
                line += 1
            lastpos += 1
        pragma_marks.append({
            'name': mark.group(1),
            'cursor_kind': 'PRAGMA_MARK',
            'extent': {
                'start': {'row': line, 'column': 0},
                'end': {'row': line + 1, 'column': 0},
            },
        })

    # Top-level macro instantiations appear out of order.
    result = sorted(result, key=lambda x: (
        x['extent']['start']['row'],
        x['extent']['start']['column'],
        x['extent']['end']['row'],
        x['extent']['end']['column'],
    ))

    # Convert into a stack for efficient removal.
    pragma_marks.reverse()
    return insert_pragma_marks(pragma_marks, result)
