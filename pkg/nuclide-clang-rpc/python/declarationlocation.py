# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

from clang.cindex import Cursor, CursorKind
from utils import location_dict, range_dict_relative, resolve_file_name
import logging
import os
import re

logger = logging.getLogger(__name__)
patterns = {
    'incl':  re.compile('^[ \t]*#[ \t]*(?:include|import)[ \t]+["<]([^\s"<>]+?)[">][ \t]*$'),
    'rel':   re.compile('"(.+?)"'),
    'abs':   re.compile('<(.+?)>'),
    'iflag': re.compile('^-I(\S+)$'),
    'fflag': re.compile('^-F(\S+)$')
}


def get_include_path_extent(line_text):
    res = patterns['incl'].match(line_text)
    if res is None:
        return None
    return (res.start(1), res.end(1))


def resolve_include(source_path, line_text, flags):
    # For relative includes, just resolve the absolute path using the source path.
    res = patterns['rel'].search(line_text)
    if res is not None:
        dir_name = source_path
        if os.path.isfile(source_path):
            dir_name = os.path.dirname(source_path)
        path = res.group(1)
        fullpath = os.path.normpath(os.path.join(dir_name, path))
        if os.path.isfile(fullpath):
            return resolve_file_name(fullpath)
    else:
        # Only check for absolute if text did not match the relative pattern,
        # otherwise attempt to resolve the relative include as an absolute path.
        res = patterns['abs'].search(line_text)

    # For absolute includes, or if no file was found for the previously matched
    # relative path, retrieve include paths from flags and search these paths
    # for the included file.
    if res is not None:
        dir_names, framework_dir_names = get_include_paths_from_flags(flags)
        # look in include dirs
        path = res.group(1)
        for dir_name in dir_names:
            fullpath = os.path.normpath(os.path.join(dir_name, path))
            if os.path.isfile(fullpath):
                return resolve_file_name(fullpath)

        # look in frameworks, which have the pattern <FrameworkName/header.h>, which resolves to
        #   <framework root path from the flag>/FrameworkName.framework/Headers/header.h
        #   <framework root path from the flag>/FrameworkName.framework/PrivateHeaders/header.h
        # clang will look for header.h in both folders in order
        slash_index = path.find('/')
        if slash_index == -1:
            pass
        framework = path[0:slash_index]
        header = path[slash_index+1:]
        for framework_dir_name in framework_dir_names:
            framework_path = os.path.normpath(os.path.join(framework_dir_name,
                                                           framework + '.framework'))
            headers_path = os.path.join(framework_path, 'Headers')
            private_headers_path = os.path.join(framework_path, 'PrivateHeaders')
            for folder in [headers_path, private_headers_path]:
                fullpath = os.path.join(folder, header)
                if os.path.isfile(fullpath):
                    return resolve_file_name(fullpath)
    return None


def get_include_paths_from_flags(flags):
    incl_paths, isys_paths, iframework_paths = [], [], []

    for idx, flag in enumerate(flags):
        # -I <<path>>
        if flag == '-I':
            if idx + 1 >= len(flags):
                break
            incl_paths.append(normalize_path(flags[idx + 1]))
        # -isystem <<path>>
        elif flag == '-isystem':
            if idx + 1 >= len(flags):
                break
            isys_paths.append(normalize_path(flags[idx + 1]))
        # -iframework <<path>>
        elif flag == '-iframework':
            if idx + 1 >= len(flags):
                break
            iframework_paths.append(normalize_path(flags[idx + 1]))
        else:
            # -I<<path>> (no whitespace between flag and path)
            res = patterns['iflag'].match(flag)
            if res is not None:
                incl_paths.append(normalize_path(res.group(1)))
            # -F<<path>> (no whitespace between flag and path)
            res = patterns['fflag'].match(flag)
            if res is not None:
                iframework_paths.append(normalize_path(res.group(1)))

    return incl_paths + isys_paths, iframework_paths


def normalize_path(path):
    # If present, strip ".hmap" suffix to get the corresponding dir path.
    if path.endswith('.hmap'):
        return path[:-5]
    return path


def get_line(content, line_num):
    lines = content.splitlines()
    if line_num > 0 and line_num <= len(lines):
        return lines[line_num - 1]
    return ""


def get_declaration_location_and_spelling(translation_unit, contents, flags,
                                          absolute_path, line, column):
    def log(s):
        logger.info('%s:%d:%d - %s',
                    os.path.basename(absolute_path), line, column, s)

    source_location = translation_unit.get_location(
        absolute_path, (line, column))
    cursor = Cursor.from_location(translation_unit, source_location)
    if cursor is None:
        log('No cursor')
        return None

    # Don't allow clicks/tooltips on most declarations, as their content is usually obvious.
    # Make an exception for variable declarations, as these can often have auto types.
    if cursor.kind != CursorKind.VAR_DECL and cursor.kind.is_declaration():
        log('Ignoring declaration')
        return None

    referenced = cursor.referenced
    if referenced is None or referenced.location is None or referenced.location.file is None:
        # If cursor is over an include statement, attempt to resolve the location
        # of the included file.
        line_text = get_line(contents, line)
        bounds = get_include_path_extent(line_text)

        if bounds is not None:
            start_col, end_col = bounds
            # Don't allow hyperclick if cursor is not over the include name, i.e.:
            # #include "header.h"
            #          ^^^^^^^^
            if column < start_col or column > end_col:
                return None

            filename = resolve_include(absolute_path, line_text, flags)
            if filename is None:
                return None
            # Point location to beginning of the found included file (line 0, column 0)
            location = {
                'file': filename,
                'point': {
                    'row': 0,
                    'column': 0,
                },
                # Show destination file of hyperclick in hover popover
                'type': filename,
                'spelling': None,
                'extent': {
                    'start': {'row': line - 1, 'column': start_col},
                    'end': {'row': line - 1, 'column': end_col}
                }
            }
            return location
        else:
            log('No referenced information')
            return None

    loc = referenced.location
    log('Returning {0}:{1}:{2}'.format(
        os.path.basename(loc.file.name), loc.line, loc.column))

    # An extent has a `start` and `end` property, each of which have a `line`
    # and `column` property.
    extent = cursor.extent

    type = None
    try:
        type = cursor.type and cursor.type.spelling
    except:
        logger.warn('Was not able to get cursor type')
        pass

    location = location_dict(loc)
    location['spelling'] = cursor.spelling
    location['type'] = type
    location['extent'] = range_dict_relative(extent)
    return location
