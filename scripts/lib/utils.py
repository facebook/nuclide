# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

import codecs
import collections
import errno
import json
import os
import os.path
import subprocess
import sys
import time


# http://www.tldp.org/LDP/abs/html/exitcodes.html
EXIT_KEYBOARD_INTERRUPT = 130


class TestFailureError(Exception):
    def __init__(self, message, code=1):
        Exception.__init__(self, message)
        self.code = code


def check_output(*popenargs, **kwargs):
    """
    This is a subprocess.check_output() implementation from Python 2.7
    """
    process = subprocess.Popen(stdout=subprocess.PIPE, *popenargs, **kwargs)
    output, _ = process.communicate()
    retcode = process.poll()
    if retcode:
        cmd = kwargs.get("args")
        if cmd is None:
            cmd = popenargs[0]
        error = subprocess.CalledProcessError(retcode, cmd)
        error.output = output
        raise error
    return output


def retryable(num_retries=0, sleep_time=0, exponential=False):
    """
    A decorator for retrying a function call. The function will be called
    until it succeeds or num_tries times reached.
    The function must raise an exception to signify failure.

    num_retries     - number of tries before giving up
    sleep_time      - number of seconds to sleep between each falure
    exponential     - progressively double sleep_time between retries
    """

    def _decorator(fn):
        def _wrapper(*args, **kwargs):
            run = 0
            cur_sleep_time = sleep_time
            exception = None
            while run <= num_retries:
                run += 1
                try:
                    return fn(*args, **kwargs)
                except Exception as e:
                    exception = e
                    time.sleep(cur_sleep_time)
                    cur_sleep_time = (
                        cur_sleep_time * 2 if exponential else cur_sleep_time
                    )
            raise exception

        return _wrapper

    return _decorator


def symlink(src, dest, relative=False):
    """
    Create symlink from src to dest, create directory if dest's dirname doesn't
    exist, won't throw exception if dest already exists and its symlink points
    to src.

    relative        - create relative symlink instead of absolute symlink
    """
    dest_dir = os.path.dirname(dest)
    if not os.path.isdir(dest_dir):
        os.makedirs(dest_dir)
    if not os.path.islink(dest) or os.path.realpath(
        os.path.join(dest_dir, src)
    ) != os.path.realpath(dest):
        try:
            if relative and os.path.isabs(src):
                src = os.path.relpath(src, os.path.dirname(dest))
            os.symlink(src, dest)
        except OSError as e:
            if e.errno == errno.EEXIST:
                os.remove(dest)
                os.symlink(src, dest)


def json_dump(obj, path, sort_keys=True):
    with open(path, "w") as f:
        # Separators must be specified to avoid trailing whitespace.
        # Python is dumb: http://bugs.python.org/issue16333.
        json.dump(obj, f, indent=2, separators=(",", ": "), sort_keys=sort_keys)
        # Make sure all files we write out end with a trailing newline.
        f.write("\n")


def json_dumps(obj, indent=2, sort_keys=True):
    return json.dumps(obj, indent=indent, separators=(",", ": "), sort_keys=sort_keys)


def json_load(path):
    # We use codecs here because sometimes Python decides to use the ascii
    # codec and chokes on utf-8 characters. This has bitten us in the past.
    with codecs.open(path, "r", "utf-8") as f:
        if sys.version_info >= (2, 7):
            # object_pairs_hook=... preserves member order iteration in the
            # resulting objects Member order is used by package linting
            # However, this is Python 2.7 only, so we conditionally enable it
            return json.load(f, object_pairs_hook=collections.OrderedDict)
        else:
            return json.load(f)


def json_loads(string):
    return json.loads(string)
