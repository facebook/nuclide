# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

from __future__ import print_function
import sys


def log_debug(output):
    print(output.encode('utf-8'))
    sys.stdout.flush()

def log_error(output):
    print(output.encode('utf-8'), file=sys.stderr)
    sys.stderr.flush()
