# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See LICENSE in the project root
# for license information.

# TODO: only absolute_import needed?
from __future__ import print_function, with_statement, absolute_import

import sys

if sys.version_info >= (3,):
    from ptvsd.reraise3 import reraise  # noqa: F401
else:
    from ptvsd.reraise2 import reraise  # noqa: F401
