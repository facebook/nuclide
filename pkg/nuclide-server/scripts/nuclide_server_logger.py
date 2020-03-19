#!/usr/bin/env python

# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

import errno
import getpass
import logging
import logging.handlers
import os
import sys
import tempfile

from logging.handlers import BufferingHandler

LOG_FILE_DIR = os.path.join(tempfile.gettempdir(),
                            'nuclide-{0}-logs/server-start/'.format(getpass.getuser()))
LOG_FILE_TEMPLATE = 'nuclide.log'
LOG_DIR_ERROR_MSG = 'An error occurred while creating the Nuclide server-start log directory. \
                     Nuclide server-start logs will not be written.'


class NuclideCircularBufferHandler(BufferingHandler):
    '''A logging handler that stores logs in memory with limited capacity, implemented by circular buffer.
    '''
    # Section: implementation of BufferingHandler api.
    # https://docs.python.org/2/library/logging.handlers.html#logging.handlers.BufferingHandler

    def __init__(self, capacity):
        # BufferingHandler is old styled class, so we can't use super here.
        BufferingHandler.__init__(self, capacity)
        self._buffer = []
        self._capacity = capacity
        self._position = 0

    def emit(self, record):
        if len(self._buffer) < self._capacity:
            self._buffer.append(self.format(record))
        else:
            self._buffer[self._position] = self.format(record)
        self._position = (self._position + 1) % self._capacity

    def flush(self):
        pass

    def shouldFlush(record):
        return False

    # Section: customized api to get logs in buffer.

    def getBufferedLogs(self):
        if len(self._buffer) < self._capacity:
            return self._buffer[:]
        return self._buffer[self._position:] + self._buffer[:self._position]


buffer_handler = NuclideCircularBufferHandler(100)


def get_buffered_logs():
    return buffer_handler.getBufferedLogs()


def _get_log_file_path():
    return os.path.join(LOG_FILE_DIR, LOG_FILE_TEMPLATE)


# Returns a boolean of whether the log directory exists or was successfully created.
def _make_log_dir():
    try:
        os.makedirs(LOG_FILE_DIR)
    except OSError as e:
        if e.errno == errno.EEXIST:
            # The log directory exists
            return True
        print(LOG_DIR_ERROR_MSG)
        return False
    except Exception:
        # Any other error
        print(LOG_DIR_ERROR_MSG)
        return False
    return True


def configure_nuclide_logger(verbose=False):
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')

    # Save last 100 logs into buffer.
    buffer_handler.setLevel(logging.INFO)
    buffer_handler.setFormatter(formatter)
    root_logger.addHandler(buffer_handler)

    # Print logs to stdout if verbose is specified.
    if verbose:
        stdout_handler = logging.StreamHandler(sys.stdout)
        stdout_handler.setLevel(logging.DEBUG)
        stdout_handler.setFormatter(formatter)
        root_logger.addHandler(stdout_handler)

    # Write logs to file using file handler.
    if not _make_log_dir():
        return

    file_handler = logging.handlers.RotatingFileHandler(_get_log_file_path(),
                                                        maxBytes=10000,
                                                        backupCount=7)
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)
    root_logger.addHandler(file_handler)
