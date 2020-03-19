#!/usr/bin/env python2

# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

import sys
import shutil
import zipfile

sourceFile = sys.argv[1]
destFile = 'org.eclipse.jdt.debug.jdimodel-3.10.1.jar'

with zipfile.ZipFile(sourceFile, "r") as zip_ref:
    zip_ref.extractall(".")

shutil.copyfile("jdimodel.jar", destFile)
