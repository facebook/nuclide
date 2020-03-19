# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See LICENSE in the project root
# for license information.

import os.path
import sys

import ptvsd
import pydevd


def attach_main(address, pid, *extra, **kwargs):
    hostname, port_num = address

    ptvsd_path = os.path.join(ptvsd.__file__, '../..')
    pydevd_attach_to_process_path = os.path.join(
        os.path.dirname(pydevd.__file__),
        'pydevd_attach_to_process')
    sys.path.append(pydevd_attach_to_process_path)
    from add_code_to_python_process import run_python_code

    # The code must not contain single quotes. Also, it might be running on
    # a different Python version once it's injected. Encoding string literals
    # as raw UTF-8 byte values takes care of both.
    code = '''
ptvsd_path = bytearray({ptvsd_path}).decode("utf-8")
hostname = bytearray({hostname}).decode("utf-8")

import sys
sys.path.insert(0, ptvsd_path)
import ptvsd
del sys.path[0]

from ptvsd._remote import attach
attach((hostname, {port_num}))
'''

    code = code.format(
        ptvsd_path=repr(list(ptvsd_path.encode('utf-8'))),
        hostname=repr(list(hostname.encode('utf-8'))),
        port_num=port_num)
    run_python_code(pid, code, connect_debugger_tracing=True)
