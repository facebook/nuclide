#!/usr/bin/env python2

# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.
"""Python file license header linter."""

from __future__ import print_function

import fnmatch
import os
import os.path
import re
import sys

from package_manager import NUCLIDE_PATH


IGNORES = [
    # Test fixtures don't need the header.
    "*/spec/fixtures/*",
    "*/__mocks__/fixtures/*",
]

EXCLUDE_DIRS = ["node_modules", "VendorLib"]

# The headers are intentionally repeated for easy copy/paste.

SIMPLE_HEADER = """\
# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.
"""

SHEBANG_HEADER = """\
#!/usr/bin/env python

# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.
"""

SHEBANG_HEADER2 = """\
#!/usr/bin/env python2

# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.
"""

SHEBANG_HEADER3 = """\
#!/usr/bin/env python3

# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.
"""

SHEBANG_HEADER3_6 = """\
#!/usr/bin/env python3.6

# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.
"""


def _find_py_files(basedir):
    found = []
    ignore = re.compile(r"|".join([fnmatch.translate(p) for p in IGNORES]))
    for root, dirs, files in os.walk(basedir):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        files = [os.path.join(root, f) for f in files]
        files = [f for f in files if f.endswith(".py") and not re.match(ignore, f)]
        found += files
    return found


class LintPyHeaders(object):
    def __init__(self):
        self._basedir = NUCLIDE_PATH
        self._py_files = _find_py_files(self._basedir)

    def get_py_files(self):
        return self._py_files

    def get_invalid_files(self):
        found = []
        for path in self._py_files:
            with open(path, "r") as read_f:
                text = read_f.read()
            if text and not (
                text.startswith(SIMPLE_HEADER)
                or text.startswith(SHEBANG_HEADER)
                or text.startswith(SHEBANG_HEADER2)
                or text.startswith(SHEBANG_HEADER3)
                or text.startswith(SHEBANG_HEADER3_6)
            ):
                rel_path = os.path.relpath(path, self._basedir)
                found.append(rel_path)
        return found

    def get_errors(self):
        return [
            'File "%s" has an invalid license header.' % f
            for f in self.get_invalid_files()
        ]


def main():
    lint_py_headers = LintPyHeaders()
    print("Found .py files:\n%s" % "\n".join(lint_py_headers.get_py_files()))
    errors = lint_py_headers.get_errors()
    if errors:
        print("Error(s):\n%s" % "\n".join(errors), file=sys.stderr)
        sys.exit(1)
    else:
        print("No errors.")


if __name__ == "__main__":
    main()
