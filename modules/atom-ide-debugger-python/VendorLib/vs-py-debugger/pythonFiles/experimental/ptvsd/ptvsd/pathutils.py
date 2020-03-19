# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See LICENSE in the project root
# for license information.

from __future__ import print_function, with_statement, absolute_import

from glob import glob
import os.path
import platform


MAX_FILES_TO_CACHE = 1000


class PathUnNormcase(object):
    """Ensures path names of files are returned as they exist on the fs."""

    def __init__(self):
        self._dict = {}
        self._enabled = False

    def enable(self):
        self._enabled = platform.system() == 'Windows'

    def un_normcase(self, file_path):
        if not self._enabled or len(file_path) == 0:
            return file_path
        if file_path in self._dict:
            return self._dict[file_path]
        file_path_to_return = self._get_actual_filename(file_path)
        self.track_file_path_case(file_path_to_return)
        return file_path_to_return

    def track_file_path_case(self, file_path):
        if not self._enabled:
            return
        if len(self._dict) > MAX_FILES_TO_CACHE:
            self._dict.clear()
        self._dict[file_path] = file_path

    def _get_actual_filename(self, name):
        """
        Use glob to search for a file by building a regex.
        Original source from https://stackoverflow.com/a/30374360/4443457
        (Modified to match file name as well).
        """

        sep = os.path.sep
        parts = os.path.normpath(name).split(sep)
        dirs = parts[0:-1]
        filename = '{}[{}]'.format(parts[-1][:-1], parts[-1][-1:])
        path_fragment1 = dirs[0].upper()
        if dirs[0] == os.path.splitdrive(name)[0]:
            fragments = [path_fragment1]
        else:
            dir_names = os.listdir(os.getcwd())
            fragments = list(filter(
                            lambda x: x.upper() == path_fragment1, dir_names))
        fragments += list('{}[{}]'.format(d[:-1], d[-1])
                          for d in dirs[1:] if d)
        path = glob(sep.join(fragments))
        if not path:
            return name
        res = glob(sep.join((path[0], filename)))
        if not res:
            return name
        return res[0]
