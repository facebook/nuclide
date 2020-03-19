# Python Tools for Visual Studio
# Copyright(c) Microsoft Corporation
# All rights reserved.
# 
# Licensed under the Apache License, Version 2.0 (the License); you may not use
# this file except in compliance with the License. You may obtain a copy of the
# License at http://www.apache.org/licenses/LICENSE-2.0
# 
# THIS CODE IS PROVIDED ON AN  *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS
# OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY
# IMPLIED WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
# MERCHANTABLITY OR NON-INFRINGEMENT.
# 
# See the Apache Version 2.0 License for specific language governing
# permissions and limitations under the License.

__all__ = [
    '__version__', '__author__',
    'enable_attach', 'wait_for_attach', 'break_into_debugger', 'is_attached',
]
__all__ += ['enable_attach_ui', 'set_attach_ui_options', 'set_trace']

import sys
import os
import warnings

ptvsd_real_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'experimental', 'ptvsd'))
sys.path.append(ptvsd_real_path)
ptvsd_false_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.remove(ptvsd_false_path + '/')

try:
    dict_contains = dict.has_key
except:
    try:
        #Py3k does not have has_key anymore, and older versions don't have __contains__
        dict_contains = dict.__contains__
    except:
        try:
            dict_contains = dict.has_key
        except NameError:
            def dict_contains(d, key):
                return d.has_key(key)


if dict_contains(sys.modules, 'ptvsd'):
    sys.modules['$ptvsd'] = sys.modules['ptvsd']
    __name__ = '$ptvsd'
    del sys.modules['ptvsd']

with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    from ptvsd import __version__, __author__
    from ptvsd.attach_server import enable_attach, wait_for_attach, break_into_debugger, is_attached, enable_attach_ui, set_attach_ui_options, set_trace
