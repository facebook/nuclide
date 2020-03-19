#!/usr/bin/env python

# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.
"""
Utility to create a new feature package for Nuclide. Usage:

    ./create_package nuclide-foo

This will create the directory and all of the necessary boilerplate:

    pkg/nuclide-foo
        |-- package.json
        +-- lib/main.js
"""

from __future__ import print_function

import commands
import os
import os.path
import sys

from lib.package_manager import PACKAGES_PATH


try:
    input = raw_input
except NameError:
    pass

ATOM_PACKAGE = "AtomPackage"
ATOM_LIBRARY = "AtomLibrary"
NODE_LIBRARY = "NodeLibrary"

DEFAULT_PREFIX = "nuclide"
PACKAGE_PREFIXES = [DEFAULT_PREFIX, "fb", "sample", "dev"]
ATOM_TEST_RUNNER_FILE = os.path.join(
    PACKAGES_PATH, "../modules/nuclide-jest/atom-runner.js"
)
NUCLIDE_JEST_BIN = os.path.join(PACKAGES_PATH, "../modules/nuclide-jest/bin/jest-node")

USERNAME = commands.getoutput("whoami")

COPYRIGHT_BLOCK = """\
/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 */"""

ATOM_MAIN_JS = """\
%s

import createPackage from 'nuclide-commons-atom/createPackage';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

class Activation {
  _disposables: UniversalDisposable;

  constructor(state: ?mixed) {
    // TODO(%s): Add activation code here.
    this._disposables = new UniversalDisposable();
  }

  dispose(): void {
    this._disposables.dispose();
  }
}

createPackage(module.exports, Activation);
""" % (
    COPYRIGHT_BLOCK,
    USERNAME,
)

NODE_MAIN_JS = """\
%s

module.exports = {
  // TODO(%s): Add export code here.
};
""" % (
    COPYRIGHT_BLOCK,
    USERNAME,
)

ATOM_PACKAGE_PACKAGE_JSON_TEMPLATE = """\
{
  "name": "%s",
  "main": "./lib/main.js",
  "version": "0.0.0",
  "description": "",
  "author": "Replace this with the name of the team responsible for maintaining this package",
  "nuclide": {
    "packageType": "AtomPackage"
  },
  "activationCommands": {
  }
}
"""

ATOM_LIBRARY_PACKAGE_JSON_TEMPLATE = """\
{
  "name": "%s",
  "main": "./lib/main.js",
  "version": "0.0.0",
  "description": "",
  "author": "Replace this with the name of the team responsible for maintaining this package",
  "nuclide": {
    "packageType": "AtomLibrary"
  }
}
"""

NODE_LIBRARY_PACKAGE_JSON_TEMPLATE = """\
{
  "name": "%s",
  "main": "./lib/main.js",
  "version": "0.0.0",
  "description": "",
  "author": "Replace this with the name of the team responsible for maintaining this package",
  "nuclide": {
    "packageType": "NodeLibrary"
  }
}
"""


# Return the package name.
def get_package_name(user_input):
    for dirname in PACKAGE_PREFIXES:
        if user_input.startswith(dirname + "-"):
            return user_input
    # If user input does not start with any known prefix, default to 'nuclide'.
    # For example, given 'foo', we shall return 'nuclide-foo'
    return DEFAULT_PREFIX + "-" + user_input


def create_package(package_name, package_type):
    # Create the directory for the new package.
    pkg_dir = os.path.join(PACKAGES_PATH, package_name)
    os.makedirs(pkg_dir)

    # Add the lib/main.js file.
    lib_dir = os.path.join(pkg_dir, "lib")
    os.makedirs(lib_dir)
    with open(os.path.join(lib_dir, "main.js"), "w") as f:
        f.write(NODE_MAIN_JS if package_type == NODE_LIBRARY else ATOM_MAIN_JS)

    # Add the __tests__ folder.
    tests_dir = os.path.join(pkg_dir, "__tests__")
    atom_tests_dir = os.path.join(pkg_dir, "__atom_tests__")
    os.makedirs(tests_dir)
    if package_type == "AtomPackage" or package_type == "AtomLibrary":
        os.makedirs(atom_tests_dir)

    # Add the package.json file.
    with open(os.path.join(pkg_dir, "package.json"), "w") as f:
        if package_type == NODE_LIBRARY:
            f.write(NODE_LIBRARY_PACKAGE_JSON_TEMPLATE % (package_name))
        elif package_type == ATOM_LIBRARY:
            f.write(ATOM_LIBRARY_PACKAGE_JSON_TEMPLATE % (package_name))
        elif package_type == ATOM_PACKAGE:
            f.write(ATOM_PACKAGE_PACKAGE_JSON_TEMPLATE % (package_name))
        else:
            raise Exception("Unknown package type " + package_type)

    print("New package created at: %s." % pkg_dir)


def prompt_and_create_package(user_input):
    if user_input is None:
        user_input = input("Enter the name of your new package: ").strip()
    package_name = get_package_name(user_input)
    print("Using %s as package name under pkg/%s." % (package_name, package_name))

    answer = input(
        "Can this package be used outside of Atom " + "(e.g., on a server)? [Y/n]: "
    ).strip()
    if len(answer) > 0 and (answer[0] == "N" or answer[0] == "n"):
        answer = input(
            "Can this package be loaded synchronously via "
            + "require() in Atom? [Y/n]: "
        ).strip()
        if len(answer) > 0 and (answer[0] == "N" or answer[0] == "n"):
            package_type = ATOM_PACKAGE
        else:
            package_type = ATOM_LIBRARY
    else:
        package_type = NODE_LIBRARY

    print("Using %s as package type." % package_type)

    create_package(package_name, package_type)


def main():
    args = sys.argv[1:]
    user_input = args[0] if len(args) > 0 else None
    prompt_and_create_package(user_input)


if __name__ == "__main__":
    main()
