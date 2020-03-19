# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

import jedi
from parso.python.tree import ImportFrom


def serialize_names(names, visited):
    return list(filter(None, [serialize_name(n, visited) for n in names]))


def serialize_name(name, visited):
    if name in visited:
        # Some class structures seem to cause cycles :(
        return None
    visited.add(name)

    result = {}

    if name.type == 'class' or name.type == 'function':
        result['name'] = name.name
        try:
            result['params'] = [p.name for p in name.params]
        except Exception:
            # ".params" appears to be quite flaky.
            # e.g: https://github.com/davidhalter/jedi/issues/1031
            result['params'] = []
        result['children'] = (
            serialize_names(name.defined_names(), visited)
            if name.type == 'class' else [])
    elif name.type == 'statement':
        # Don't include underscore assignments in outline.
        if name.name == '_':
            return None
        result['name'] = name.name
    else:
        return None

    try:
        definition = name._name.tree_name.get_definition()
    except AttributeError:
        return None

    # Do not include imported definitions.
    if isinstance(definition, ImportFrom):
        return None

    (start_line, start_column) = definition.start_pos
    (end_line, end_column) = definition.end_pos

    result['start'] = {
        'line': start_line,
        'column': start_column,
    }

    result['end'] = {
        'line': end_line,
        'column': end_column,
    }

    result['kind'] = name.type

    return result


def is_toplevel(node):
    try:
        # Jedi bug: parent() throws for certain nodes.
        return node.parent().type == 'module'
    except AttributeError:
        return False


def get_outline(src, contents):
    names = jedi.api.names(source=contents, path=src, all_scopes=True)
    # Only iterate through top-level definitions.
    names = filter(is_toplevel, names)
    return serialize_names(names, visited=set())
