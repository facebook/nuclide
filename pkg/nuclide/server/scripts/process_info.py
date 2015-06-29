# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

from __future__ import print_function

import re
import shlex
import subprocess
import sys
import utils

COLUMNS = ['pid', 'command']


# TODO: Ideally, we want to use psutil, but it is not part of standard library.
class ProcessInfo(object):
    def __init__(self, columns, line):
        # Split on whitespace
        tokens = line.strip().split()
        self._fields = {}
        for i in range(len(columns)):
            self._fields[columns[i]] = tokens[i]
        if columns[i] == 'command':
            # In ps, 'comm' means the base command and 'command' is the full command.
            # So far only the first token in command is assigned to command field.
            # Assign that to 'comm' field.
            self._fields['comm'] = self._fields['command']
            # Combine the rest tokens into the full command.
            self._fields['command'] = ' '.join(tokens[i:])

    def __str__(self):
        return str(self._fields)

    def get_column(self, column_name):
        if column_name in self._fields:
            return self._fields[column_name]
        else:
            return None

    def get_command_param(self, param_name):
        command = self.get_column('command')
        if command is None:
            return None

        # Match "--param value" or "--param=value"
        pattern = '--%s(=| )([^\s]+)' % param_name
        match = re.search(pattern, command)
        if match:
            return match.group(2)
        else:
            return None

    def get_pid(self):
        return self.get_column('pid')

    def stop(self):
        pid = self.get_pid()
        args = shlex.split('kill %s' % pid)
        try:
            # Stop existing Nuclide server.
            utils.check_output_silent(args)
            return 0
        except subprocess.CalledProcessError as e:
            print('Failed to stop process %s: %s' % (pid, e.output), file=sys.stderr)
            return e.returncode

    # Use regex_filter to look for regex pattern in ps output.
    @staticmethod
    def get_processes(user=None, regex_filter=None, columns=COLUMNS):
        args = ['ps']
        if columns is None:
            # If no column specified, we will get all columns.
            args.append('-f')
        else:
            # Filter out comm and command column and then append it to the end
            # so that we can use space as delimiter.
            new_columns = [column for column in columns if column not in ['comm' ,'command']]
            new_columns.append('command')
            args.append('-o')
            args.append(','.join(columns))

        if user is None:
            # List processes from all users.
            args.append('-A')
        else:
            args.append('-u')
            args.append(user)

        stdout = utils.check_output_silent(args)
        procs = []
        for line in stdout.splitlines():
            if regex_filter is not None and re.search(regex_filter, line) is None:
                continue
            procs.append(ProcessInfo(columns, line))
        return procs
