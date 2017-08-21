# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

from __future__ import print_function
import sys

def assert_string(output):
    if not isinstance(output, basestring):
        raise Exception('non string types are not allowed in the logs')

def log_debug(output):
    assert_string(output)
    print(output)
    sys.stdout.flush()

def log_error(output):
    assert_string(output)
    print(output, file=sys.stderr)
    sys.stderr.flush()
