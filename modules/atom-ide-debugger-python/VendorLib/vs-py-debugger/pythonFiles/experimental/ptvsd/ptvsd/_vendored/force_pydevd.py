from importlib import import_module
import warnings

from . import check_modules, prefix_matcher, preimport, vendored


# Ensure that pydevd is our vendored copy.
_unvendored, _ = check_modules('pydevd',
                               prefix_matcher('pydev', '_pydev'))
if _unvendored:
    _unvendored = sorted(_unvendored.values())
    msg = 'incompatible copy of pydevd already imported'
    #raise ImportError(msg)
    warnings.warn(msg + ':\n {}'.format('\n  '.join(_unvendored)))


# Constants must be set before importing any other pydevd module
# # due to heavy use of "from" in them.
with vendored('pydevd'):
    pydevd_constants = import_module('_pydevd_bundle.pydevd_constants')
# Disable this, since we aren't packaging the Cython modules at the moment.
pydevd_constants.CYTHON_SUPPORTED = False
# We limit representation size in our representation provider when needed.
pydevd_constants.MAXIMUM_VARIABLE_REPRESENTATION_SIZE = 2**32


# Now make sure all the top-level modules and packages in pydevd are
# loaded.  Any pydevd modules that aren't loaded at this point, will
# be loaded using their parent package's __path__ (i.e. one of the
# following).
preimport('pydevd', [
    '_pydev_bundle',
    '_pydev_imps',
    '_pydev_runfiles',
    '_pydevd_bundle',
    '_pydevd_frame_eval',
    'pydev_ipython',
    'pydevd_concurrency_analyser',
    'pydevd_plugins',
    'pydevd',
])

# When pydevd is imported it sets the breakpoint behavior, but it needs to be
# overridden because the pydevd version will connect to the remote debugger by
# default, but without using the ptvsd protocol (so, we need to use the ptvsd
# API to handle things as expected by the debug adapter).
import pydevd  # noqa
import ptvsd  # noqa


def ptvsd_breakpointhook():
    ptvsd.break_into_debugger()


pydevd.install_breakpointhook(ptvsd_breakpointhook)
