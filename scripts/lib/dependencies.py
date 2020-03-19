#!/usr/bin/env python

# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

"""
Checks that the versions of all dependent programs are correct.
The list of dependent programs is in ./dependencies.json.
"""

from __future__ import absolute_import, division, print_function, unicode_literals

import logging
import os
import os.path

from lib import utils


# Set up the logging early on in the process.
logging.basicConfig(level=logging.INFO, format="%(message)s")


def get_dependencies_filename():
    return os.path.join(os.path.dirname(__file__), "dependencies.json")


def load_dependencies():
    return utils.json_load(get_dependencies_filename())


def check_dependency(cmd, expected_output):
    try:
        actual_output = utils.check_output(cmd).rstrip()
    except OSError as e:
        raise Exception("Error while running %s: %s" % (" ".join(cmd), str(e)))
    if actual_output != expected_output:
        raise Exception(
            (
                'Ran "%s" and found %s but expected %s. '
                + "Use the --no-version option to ignore this test."
            )
            % (" ".join(cmd), actual_output, expected_output)
        )


def check_dependencies(include_apm):
    dependencies = load_dependencies()
    for dependency_name in dependencies.keys():
        dependency = dependencies[dependency_name]
        if include_apm or not dependency["clientOnly"]:
            check_dependency(dependency["version-cmd"], dependency["version-output"])


def get_atom_version():
    return load_dependencies()["atom"]["version"]


def get_flow_version():
    return load_dependencies()["flow"]["version"]


def main():
    import optparse
    import sys

    parser = optparse.OptionParser(
        usage="usage: %prog [options]", description="Check dependency versions"
    )
    parser.add_option(
        "--no-atom",
        action="store_true",
        help="Exclude packages that depend on Atom",
        default=False,
    )
    options, _ = parser.parse_args(sys.argv[1:])
    check_dependencies(not options.no_atom)


if __name__ == "__main__":
    main()
