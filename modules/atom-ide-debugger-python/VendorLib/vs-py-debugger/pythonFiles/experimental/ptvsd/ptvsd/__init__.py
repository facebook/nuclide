# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See LICENSE in the project root
# for license information.

__all__ = [
    '__version__', '__author__',
    'enable_attach', 'wait_for_attach', 'break_into_debugger', 'is_attached',
]
__all__ += ['enable_attach_ui', 'set_attach_ui_options', 'set_trace']


# "force_pydevd" must be imported first to ensure (via side effects)
# that the ptvsd-vendored copy of pydevd gets used.
from ._vendored import force_pydevd
from ptvsd.version import __version__, __author__
from ptvsd.attach_server import (
    enable_attach, wait_for_attach, break_into_debugger, is_attached,
)
from ptvsd.attach_server import (
    enable_attach_ui, set_attach_ui_options, set_trace
)
del force_pydevd
