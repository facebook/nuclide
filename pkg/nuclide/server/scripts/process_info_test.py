#!/usr/bin/env python

# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

import getpass
import re
import unittest

from process_info import ProcessInfo


class ProcessInfoTest(unittest.TestCase):
    def test_get_processes(self):
        # Verify against the test process itself.
        testname = 'nuclide_server_py_tests'
        procs = ProcessInfo.get_processes(getpass.getuser(), re.escape(testname))
        found_it = False
        for proc in procs:
            # The base command is python.
            # There may be other processes with this particular pattern in it.
            if 'python' in proc.get_column('comm'):
                found_it = True
                self.assertTrue(proc.get_column('pid') is not None)
                self.assertTrue(int(proc.get_column('pid')) > 0)
                self.assertTrue(testname in proc.get_column('command'))
        self.assertTrue(found_it)


if __name__ == '__main__':
    unittest.main()
