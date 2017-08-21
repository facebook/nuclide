# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

import os
import shutil
import tempfile
import unittest
from .. import declarationlocation, utils


class DeclarationLocationTestCase(unittest.TestCase):

    def setUp(self):
        self.test_dir_rel = tempfile.mkdtemp()
        self.test_dir_abs = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.test_dir_rel)
        shutil.rmtree(self.test_dir_abs)

    def test_get_include_path_extent(self):
        # Non-include statement
        self.assertFalse(
            declarationlocation.get_include_path_extent('test')
        )

        # String contains a leading/trailing whitespace character that's not
        # a tab or space
        self.assertFalse(
            declarationlocation.get_include_path_extent('\n#include <test.h>')
        )

        # Invalid include formatting
        self.assertFalse(
            declarationlocation.get_include_path_extent('#include test.h')
        )
        self.assertFalse(
            declarationlocation.get_include_path_extent('# include test.h')
        )

        # Valid absolute include
        self.assertTupleEqual(
            declarationlocation.get_include_path_extent('#include <test.h>'),
            (10, 16)
        )

        # Valid relative include
        self.assertTupleEqual(
            declarationlocation.get_include_path_extent('#include "test.h"'),
            (10, 16)
        )

        # Valid include with leading/trailing tabs and spaces
        self.assertTupleEqual(
            declarationlocation.get_include_path_extent(' \t   #include  \t  "test.h"  \t  '),
            (19, 25)
        )

    def test_normalize_path(self):
        self.assertEqual(
            declarationlocation.normalize_path('/a/b'),
            '/a/b'
        )

        self.assertEqual(
            declarationlocation.normalize_path('/a/b.hmap'),
            '/a/b'
        )

        self.assertEqual(
            declarationlocation.normalize_path('/a/.hmapdir/b.hmap'),
            '/a/.hmapdir/b'
        )

    def test_get_include_paths_from_flags(self):
        # No path flags
        self.assertSequenceEqual(
            declarationlocation.get_include_paths_from_flags(['abc', 'cde']),
            ([], [])
        )
        self.assertSequenceEqual(
            declarationlocation.get_include_paths_from_flags(['abc', 'cde', '-I']),
            ([], [])
        )

        # -I paths
        self.assertSequenceEqual(
            declarationlocation.get_include_paths_from_flags(['-I', '/a/b']),
            (['/a/b'], [])
        )
        self.assertSequenceEqual(
            declarationlocation.get_include_paths_from_flags(['-I', '/a/b.hmap']),
            (['/a/b'], [])
        )
        self.assertSequenceEqual(
            declarationlocation.get_include_paths_from_flags(['-I/a/b.hmap']),
            (['/a/b'], [])
        )

        # -isystem paths
        self.assertSequenceEqual(
            declarationlocation.get_include_paths_from_flags(['-isystem', '/a/b']),
            (['/a/b'], [])
        )
        self.assertSequenceEqual(
            declarationlocation.get_include_paths_from_flags(['-isystem', '/a/b.hmap']),
            (['/a/b'], [])
        )

        # Non-relevant flags should be skipped.
        self.assertSequenceEqual(
            declarationlocation.get_include_paths_from_flags([
                '-I', '/a/b.hmap',
                'test',
                '-I/c/d',
                'dummy',
                '-I', '/e/f'
            ]),
            (['/a/b', '/c/d', '/e/f'], [])
        )

        # -isystem paths should be at end of search path.
        self.assertSequenceEqual(
            declarationlocation.get_include_paths_from_flags([
                '-isystem', '/this/should/be/second/last',
                '-I', '/a/b.hmap',
                'test',
                '-I/c/d',
                'dummy',
                '-I', '/e/f',
                '-isystem', '/this/should/be/last'
            ]),
            (['/a/b', '/c/d', '/e/f', '/this/should/be/second/last', '/this/should/be/last'], [])
        )

    def test_resolve_include(self):
        src_path = self.test_dir_rel

        rel_headers_path = os.path.join(src_path, 'headers')
        os.mkdir(rel_headers_path)
        rel_file_path = os.path.join(rel_headers_path, 'test_rel.h')
        # 'touch'/create an empty file
        open(rel_file_path, 'w')

        abs_headers_path = self.test_dir_abs
        abs_file_path = os.path.join(abs_headers_path, 'test_abs.h')
        # 'touch'/create an empty file
        open(abs_file_path, 'w')

        # Lines that are not include statements should result in None.
        self.assertFalse(
            declarationlocation.resolve_include(
                src_path,
                'hello world',
                ['dummy flag']
            )
        )

        # Includes of not-found files should result in None.
        self.assertFalse(
            declarationlocation.resolve_include(
                src_path,
                '#include "unicorn.h"',
                ['dummy flag']
            )
        )

        # Relative paths should resolve relative to the source path, and using
        # paths specified in flags.
        self.assertEqual(
            declarationlocation.resolve_include(
                src_path,
                '#include "headers/test_rel.h"',
                ['dummy flag']
            ),
            # The temp directory is a symlink, which our resolve_include function
            # would follow, so we need to follow the symlink here too.
            utils.resolve_file_name(rel_file_path)
        )

        # Allow extra whitespace
        self.assertEqual(
            declarationlocation.resolve_include(
                src_path,
                '   \t    #include "headers/test_rel.h"  \t  ',
                ['dummy flag']
            ),
            # The temp directory is a symlink, which our resolve_include function
            # would follow, so we need to follow the symlink here too.
            utils.resolve_file_name(rel_file_path)
        )

        # Multiple include paths specified in flags should be tried in sequence,
        # with -I paths prioritized over -isystem paths.
        self.assertEqual(
            declarationlocation.resolve_include(
                src_path,
                '#include <test_abs.h>',
                ['-isystem', '/dummypath', 'filler', '-I', abs_headers_path]
            ),
            utils.resolve_file_name(abs_file_path)
        )

        # -isystem paths should be checked as last resort, in this case.
        self.assertEqual(
            declarationlocation.resolve_include(
                src_path,
                '#include <test_abs.h>',
                ['-I/dummypath', '-isystem', abs_headers_path, 'filler']
            ),
            utils.resolve_file_name(abs_file_path)
        )

        # Relative include should fallback to checking flag paths if not found
        # using relative location
        self.assertEqual(
            declarationlocation.resolve_include(
                src_path,
                '#include "test_abs.h"',
                ['-isystem', '/dummypath', 'filler', '-I', abs_headers_path]
            ),
            utils.resolve_file_name(abs_file_path)
        )
