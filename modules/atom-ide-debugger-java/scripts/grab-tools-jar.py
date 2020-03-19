#!/usr/bin/env python2

# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

import sys
import subprocess
import shutil
import re
import os
from distutils.spawn import find_executable

destFile = 'tools-1.0.0.jar'
platform = sys.platform

if platform == "darwin":
    # Mac
    import plistlib
    # User may have multiple JDKs installed: just need one with tools.jar
    jdkVersion = "1.8"  # see `/usr/libexec/java_home --help' for ranges
    cmd = ['/usr/libexec/java_home', '--version', jdkVersion, '--xml']
    rawPlist = subprocess.check_output(cmd)
    jdks = plistlib.readPlistFromString(rawPlist)
    jdkPaths = [jdk['JVMHomePath'] for jdk in jdks]
    # If user defined JAVA_HOME, prefer that one
    userJavaHome = os.environ.get('JAVA_HOME')
    if userJavaHome:
        jdkPaths = [userJavaHome] + jdkPaths
    potentialToolsJars = filter(
        os.path.exists,
        [os.path.join(jdkPath, 'lib/tools.jar') for jdkPath in jdkPaths])
    if potentialToolsJars:
        toolsJar = potentialToolsJars[0]
    else:
        raise ValueError("Cannot find tools.jar for jdk %s" % jdkVersion)

elif platform == "linux" or platform == "linux2":
    # Linux
    javaBin = executable = find_executable("java")
    javaHome = os.path.realpath(javaBin).strip()
    pattern = re.compile("(.*)\/java$")
    match = pattern.search(javaHome)
    toolsJar = match.group(1) + "/../lib/tools.jar"
elif platform == "win32":
    # Windows
    javaHome = os.environ['JAVA_HOME']
    toolsJar = javaHome + "\\..\\lib\\tools.jar"
else:
    raise ValueError("Unknown platform")

shutil.copyfile(toolsJar, destFile)
