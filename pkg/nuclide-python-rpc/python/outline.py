# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

import jedi


def serialize_names(names):
    return list(filter(None, [serialize_name(n) for n in names]))


def serialize_name(name):
    result = {}

    if name.type == 'class' or name.type == 'function':
        result['name'] = name.name
        result['params'] = [(p._name.get_definition().stars * '*' + p.name)
                            for p in name.params]
        result['children'] = (
            serialize_names(name.defined_names())
            if name.type == 'class' else [])
    elif name.type == 'statement':
        # Don't include underscore assignments in outline.
        if name.name == '_':
            return None
        result['name'] = name.name
    else:
        return None

    # Get the start position of the entire line excluding whitespace, i.e.
    # the start position of the 'def' or 'class' keywords rather than the
    # function or class name itself.
    definition = name._name.get_definition()
    (start_line, start_column) = definition.start_pos
    (end_line, end_column) = definition.end_pos

    result['start'] = {
        'line': start_line,
        'column': start_column
    }
    result['end'] = {
        'line': end_line,
        'column': end_column
    }

    result['kind'] = name.type

    return result


def get_outline(src, contents):
    names = jedi.api.names(source=contents, path=src)
    return serialize_names(names)
