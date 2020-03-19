# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See LICENSE in the project root
# for license information.


def reraise(exc_info):
    # TODO: docstring
    raise exc_info[1].with_traceback(exc_info[2])
