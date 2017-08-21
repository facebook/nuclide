#!/usr/bin/env python

# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

# To ensure that Nuclide is easy to set up and install,
# we want to limit our dependencies to built-in Python libraries and libclang
# (which is provided in ../pythonpath)

from clang.cindex import Config, Cursor, CursorKind, Diagnostic, File, Index,\
                         SourceLocation, TranslationUnit
from declarationlocation import get_declaration_location_and_spelling
from utils import is_header_file, resolve_file, range_dict, range_dict_relative,\
                  location_dict, CXCursorAndRangeVisitor
import codecomplete
import outline
import references

import argparse
import json
import getpass
import hashlib
import logging
import os
import sys
import tempfile
import time
import traceback
from ctypes import c_char_p, c_int, c_uint, c_void_p, POINTER
from distutils.version import LooseVersion
from logging import FileHandler, StreamHandler

LOGGING_DIR = 'nuclide-%s-logs/clang' % getpass.getuser()
FD_FOR_READING = 3

# Unfortunately Clang has no way of limiting autocompletion results, but set a reasonable limit
# to avoid overloading the Atom UI.
COMPLETIONS_LIMIT = 200


# Clang warns when you use #pragma once in the main compilation unit.
# However, we often build compilation units from header files here, so avoid the nag.
# https://llvm.org/bugs/show_bug.cgi?id=16686
PRAGMA_ONCE_IN_MAIN_FILE = '#pragma once in main file'


root_logger = logging.getLogger()


def log_filename(value):
    hash = hashlib.md5(value).hexdigest()[:10]
    return os.path.basename(value) + '-' + hash + '.log'


def set_up_logging(src):
    # Be consistent with the main Nuclide logs.
    log_dir = os.path.join(tempfile.gettempdir(), LOGGING_DIR)
    try:
        os.makedirs(log_dir)
    except OSError:
        # Assume the directory already exists.
        pass
    handler = FileHandler(os.path.join(log_dir, log_filename(src)))
    handler.setFormatter(logging.Formatter(
        'nuclide-clang-py %(asctime)s: [%(name)s] %(message)s'
    ))
    root_logger.addHandler(handler)

    # Output warning logs to stderr to be surfaced in Nuclide.
    handler = StreamHandler(sys.stderr)
    handler.setLevel(logging.WARNING)
    root_logger.addHandler(handler)

    root_logger.setLevel(logging.INFO)
    root_logger.info('starting for ' + src)


def child_diagnostics(lib, diag):
    class ChildDiagnosticsIterator:

        def __init__(self, diag):
            self.ds = lib.clang_getChildDiagnostics(diag)

        def __len__(self):
            return int(lib.clang_getNumDiagnosticsInSet(self.ds))

        def __getitem__(self, key):
            diag = lib.clang_getDiagnosticInSet(self.ds, key)
            if not diag:
                raise IndexError
            return Diagnostic(diag)

    return ChildDiagnosticsIterator(diag)


class Server:
    # Extra functions from the libclang API.
    # TOOD(hansonw): Remove this when these bindings are upstreamed.
    CUSTOM_CLANG_FUNCTIONS = [
        ("clang_getChildDiagnostics",
         [Diagnostic],
            POINTER(c_void_p)),

        ("clang_getNumDiagnosticsInSet",
            [POINTER(c_void_p)],
            c_uint),

        ("clang_getDiagnosticInSet",
            [POINTER(c_void_p), c_uint],
            POINTER(c_void_p)),

        ("clang_getClangVersion",
            [],
            POINTER(c_void_p)),

        ("clang_getCString",
            [c_void_p],
            c_char_p),

        ("clang_sortCodeCompletionResults",
            [c_void_p, c_uint],
            None),

        # Much faster than actually fetching/checking the file string.
        ("clang_Location_isFromMainFile",
            [SourceLocation],
            c_int),

        ("clang_findReferencesInFile",
            [Cursor, File, CXCursorAndRangeVisitor],
            c_uint),
    ]

    # New in Clang 3.8: not in the Python bindings yet.
    # Should also be removed once upstreamed.
    PARSE_CREATE_PREAMBLE_ON_FIRST_PARSE = 0x100

    # Prefix of the string returned by clang_getClangVersion.
    CLANG_VERSION_PREFIX = 'clang version'

    def __init__(self, src, flags, input_stream, output_stream):
        self.src = src
        self.flags = flags
        self.input_stream = input_stream
        self.output_stream = output_stream
        self.index = Index.create()
        self.translation_unit = None
        self.completion_cache = None
        self.cached_contents = None
        conf = Config()
        self.custom_clang_lib = conf.lib
        self._register_custom_clang_functions()

        # Cache the libclang version.
        cxstr = self.custom_clang_lib.clang_getClangVersion()
        version = self.custom_clang_lib.clang_getCString(cxstr)

        if version.startswith(Server.CLANG_VERSION_PREFIX):
            version = version[len(Server.CLANG_VERSION_PREFIX):]
        else:
            version = '3.7.0'
        self.clang_version = LooseVersion(version)

    def run(self):
        input_stream = self.input_stream
        output_stream = self.output_stream
        while True:
            line = input_stream.readline()
            response = self.process_request(line)
            json.dump(response, output_stream)
            # Use \n to signal the end of the response.
            output_stream.write('\n')
            output_stream.flush()

    def process_request(self, line):
        '''
        request should be a dict containing id and args.
        The response will be a dict containing id and exactly one of result/error.
        '''
        request = json.loads(line)

        reqid = request['id']
        method = request['method']
        args = request['args']

        start_time = time.time()
        result = None
        error = None
        try:
            if method == 'compile':
                result = self.compile(args)
            elif method == 'get_completions':
                result = self.get_completions(args)
            elif method == 'get_declaration':
                result = self.get_declaration(args)
            elif method == 'get_declaration_info':
                result = self.get_declaration_info(args)
            elif method == 'get_outline':
                result = self.get_outline(args)
            elif method == 'get_local_references':
                result = self.get_local_references(args)
            else:
                error = 'Unknown method to clang_server.py: %s.' % method
        except:
            error = traceback.format_exc()

        root_logger.info('Finished %s request in %.2lf seconds.',
                         method, time.time() - start_time)

        response = {
            'protocol': 'clang_language_service',
            'id': reqid,
        }
        if error is not None:
            response['type'] = 'error-response'
            response['error'] = error
        else:
            response['type'] = 'response'
            response['result'] = result
        return response

    def compile(self, request):
        contents = request['contents']

        # Update the translation unit with the latest contents.
        # Force a re-parse, in case the user e.g. changed a header file.
        self.cached_contents = None
        translation_unit = self._update_translation_unit(contents)
        if not translation_unit:
            return {'diagnostics': []}

        # Return the diagnostics.
        diagnostics = []
        for diag in translation_unit.diagnostics:
            if diag.spelling == PRAGMA_ONCE_IN_MAIN_FILE and is_header_file(self.src):
                continue
            diagnostics.append(self.diagnostic_dict(diag))
        return {'diagnostics': diagnostics}

    def diagnostic_dict(self, diag):
        ranges = map(range_dict, diag.ranges)
        if len(ranges) == 0:
            ranges = None
        fixits = []
        for fixit in diag.fixits:
            fixits.append({
                'range': range_dict(fixit.range),
                'value': fixit.value,
            })
        children = []
        for child in child_diagnostics(self.custom_clang_lib, diag):
            children.append({
                'spelling': child.spelling,
                'location': location_dict(child.location),
                'ranges': map(range_dict, child.ranges),
            })
            # Some fixits may be nested; add them to the root diagnostic.
            for fixit in child.fixits:
                fixits.append({
                    'range': range_dict(fixit.range),
                    'value': fixit.value,
                })
        return {
            'spelling': diag.spelling,
            'severity': diag.severity,
            'location': location_dict(diag.location),
            'ranges': ranges,
            'fixits': fixits,
            'children': children,
        }

    def get_completions(self, request):
        contents = request['contents']
        line = request['line']
        prefix = request['prefix']
        token_start_column = request['tokenStartColumn']

        # NOTE: there is no need to update the translation unit here.
        # libclang's completions API seamlessly takes care of unsaved content
        # without any special handling.
        translation_unit = self._get_translation_unit(None)
        if translation_unit:
            if self.completion_cache is None:
                self.completion_cache = codecomplete.CompletionCache(
                    self.src, translation_unit, self.custom_clang_lib)
            return self.completion_cache.get_completions(
                line + 1,
                token_start_column + 1,
                prefix,
                contents,
                limit=COMPLETIONS_LIMIT)
        return []

    def get_declaration(self, request):
        contents = request['contents']
        line = request['line']
        column = request['column']

        # Update the translation unit with the latest contents.
        translation_unit = self._update_translation_unit(contents)
        if not translation_unit:
            return None

        return get_declaration_location_and_spelling(
            translation_unit,
            contents,
            self.flags,
            self.src,
            line + 1,
            column + 1)

    def get_declaration_info(self, request):
        contents = request['contents']
        line = request['line']
        column = request['column']

        # Update the translation unit with the latest contents.
        translation_unit = self._update_translation_unit(contents)
        if not translation_unit:
            return None

        location = translation_unit.get_location(self.src, (line + 1, column + 1))
        cursor = Cursor.from_location(translation_unit, location)
        cursor = cursor.referenced
        if cursor is None:
            return None

        return self.get_declaration_info_for_cursor(cursor)

    def get_declaration_info_for_cursor(self, cursor):
        '''Returns string id in clang-callgraph-service format for entity under the
        cursor. Currently works only for definitions of class methods, instance
        methods and functions. Returns None for everything else.
        '''
        result = []
        while cursor is not None and not cursor.kind.is_translation_unit():
            file = cursor.location.file
            result.append({
                'name': self.get_name_for_cursor(cursor),
                'type': cursor.kind.name,
                'cursor_usr': cursor.get_usr(),
                'file': resolve_file(file),
                'extent': range_dict_relative(cursor.extent),
                'is_definition': cursor.is_definition(),
            })
            cursor = cursor.semantic_parent

        return result

    def get_name_for_cursor(self, cursor):
        name = cursor.displayname
        # clang doesn't include the interface name for categories; add it
        # manually
        if (cursor.kind == CursorKind.OBJC_CATEGORY_DECL or
                cursor.kind == CursorKind.OBJC_CATEGORY_IMPL_DECL):
            # Find reference to base class.
            base_name = ''
            for child in cursor.get_children():
                if child.kind == CursorKind.OBJC_CLASS_REF:
                    base_name = child.displayname
                    break
            return base_name + ' (' + name + ')'
        return name

    def get_outline(self, request):
        contents = request['contents']
        translation_unit = self._update_translation_unit(contents)
        if not translation_unit:
            return None
        return outline.get_outline(self.custom_clang_lib, translation_unit, contents)

    def get_local_references(self, request):
        contents = request['contents']
        line = request['line']
        column = request['column']
        translation_unit = self._update_translation_unit(contents)
        if not translation_unit:
            return None
        return references.local_references(
            self.custom_clang_lib, translation_unit, self.src, line + 1, column + 1)

    def _get_translation_unit(self, unsaved_contents):
        '''
        Get the current translation unit, or create it if it does not exist.
        Flags can be optional if the translation unit already exists.
        '''
        if self.translation_unit is not None:
            return self.translation_unit

        # Configure the options.
        # See also clang_defaultEditingTranslationUnitOptions in Index.h.
        options = (
            TranslationUnit.PARSE_PRECOMPILED_PREAMBLE |
            TranslationUnit.PARSE_CACHE_COMPLETION_RESULTS |
            TranslationUnit.PARSE_INCLUDE_BRIEF_COMMENTS_IN_CODE_COMPLETION |
            TranslationUnit.PARSE_DETAILED_PROCESSING_RECORD |
            TranslationUnit.PARSE_INCOMPLETE)

        # Clang 3.8 comes with CXTranslationUnit_CreatePreambleOnFirstParse,
        # which allows us to skip the forced reparse.
        # Otherwise, we have have to force an immediate reparse to generate
        # precompiled headers (necessary for fast autocompletion).
        if self.clang_version >= LooseVersion('3.8'):
            options |= Server.PARSE_CREATE_PREAMBLE_ON_FIRST_PARSE
            self.cached_contents = unsaved_contents

        args = self._get_args_for_flags()
        self.translation_unit = self.index.parse(
            self.src, args, self._make_files(unsaved_contents), options)
        return self.translation_unit

    # Clang's API expects a list of (src, contents) pairs.
    def _make_files(self, unsaved_contents):
        if unsaved_contents is None:
            return []
        return [(self.src, unsaved_contents.encode('utf-8'))]

    def _get_args_for_flags(self):
        args = [
            # Enable typo-detection (and the corresponding fixits)
            # For some reason this is not enabled by default in libclang.
            '-fspell-checking',
            # This flag disables some fancy template metaprogramming inside gtest
            # that somehow breaks Clang's autocompletion.
            # Requires PARSE_INCOMPLETE above (or else this will cause type mismatch errors).
            '-DGTEST_ELLIPSIS_NEEDS_POD_',
        ]
        skip = False
        for arg in self.flags:
            if skip:
                skip = False
                pass
            elif arg == self.src:
                # Including the input file as an argument causes index.parse() to fail.
                pass
            elif arg == '-c':
                # No need to generate a .o file.
                args.append('-fsyntax-only')
            elif arg == '-Werror':
                # We disable this so that the severity can be better reflected in the UI.
                # For example, this allows unused code to appear as a warning
                # instead of an error.
                pass
            elif arg == '-MMD' or arg == '-MD':
                # Do not write out dependency files.
                pass
            elif arg == '-MF':
                # Skip the filename parameter as well.
                skip = True
                pass
            else:
                args.append(arg)
        return args

    def _update_translation_unit(self, unsaved_contents=None):
        translation_unit = self._get_translation_unit(unsaved_contents)
        if translation_unit is None:
            return None
        # Reparsing isn't cheap, so skip it if nothing changed.
        if (unsaved_contents is not None and
                unsaved_contents == self.cached_contents):
            return translation_unit
        options = 0  # There are no reparse options available in libclang yet.
        translation_unit.reparse(self._make_files(unsaved_contents), options)
        self.cached_contents = unsaved_contents
        if self.completion_cache is not None:
            self.completion_cache.invalidate()
        return translation_unit

    def _register_custom_clang_functions(self):
        # Extend the Clang C bindings with the additional required functions.
        for item in Server.CUSTOM_CLANG_FUNCTIONS:
            func = getattr(self.custom_clang_lib, item[0])
            func.argtypes = item[1]
            func.restype = item[2]


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('src', metavar='<path>', type=str,
                        help='Full path of source file to analyze.')
    parser.add_argument('--flags-from-pipe', type=int,
                        help='Read the flags from a given file descriptor as JSON')
    parser.add_argument('flags', metavar='<flags>', type=str, nargs='*',
                        help='Extra flags to pass to Clang.')
    parser.add_argument('--libclang-file', help='Path to libclang dynamic library')
    args = parser.parse_args()

    if args.libclang_file:
        Config.set_library_file(args.libclang_file)
        set_up_logging(args.src)
    if args.flags_from_pipe:
        with os.fdopen(args.flags_from_pipe) as pipe:
            args.flags = json.loads(pipe.readline().rstrip())
    Server(args.src, args.flags, sys.stdin, sys.stdout).run()
