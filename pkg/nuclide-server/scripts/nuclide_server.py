# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

from __future__ import absolute_import
from __future__ import division
from __future__ import unicode_literals
from __future__ import absolute_import
from __future__ import division
from __future__ import unicode_literals
from __future__ import print_function

import getpass
import logging
import os
import re
import shlex
import subprocess
import sys
import time

import utils
from nuclide_certificates_generator import NuclideCertificatesGenerator
from nuclide_server_logger import LOG_FILE_DIR
from process_info import ProcessInfo

LOG_FILE = os.path.join(
    LOG_FILE_DIR,
    # Condensed ISO-8601 date/time format
    'nuclide-%s.nohup.out' % time.strftime('%Y-%m-%dT%H:%M:%S'),
)


# This class represents a Nuclide server process on a port.
class NuclideServer(object):
    # Changing this will break server upgrade, as we rely on it to find existing servers.
    script_name = 'nuclide-main.js'
    script_path = os.path.realpath(os.path.join(os.path.dirname(__file__), '../lib', script_name))

    # Pass in proc for an existing Nuclide server.
    def __init__(self, port, workspace=None, proc=None):
        self.logger = logging.getLogger('NuclideServer')
        self._clear_states()
        self.port = port
        self._proc = proc
        # TODO: really support workspace.
        self.workspace = None
        if workspace is not None:
            workspace = os.path.expanduser(workspace)
            if os.path.exists(workspace):
                self.workspace = os.path.realpath(workspace)

    # Get Nuclide server process info from ps.
    # Return a list of process info.
    # Port is an optional filter.
    # By default, it only gets you your Nuclide server processes.
    @staticmethod
    def get_processes(user=None, port=None):
        if user is None:
            user = getpass.getuser()
        matches = []
        procs = ProcessInfo.get_processes(user, re.escape(NuclideServer.script_name + " --port"))
        for proc in procs:
            port_from_proc = int(proc.get_command_param('port'))
            # If port not specified, skip port check and add to result list.
            if port is None:
                matches.append(proc)
            else:
                # If port is given, match it.
                if port_from_proc == port:
                    matches.append(proc)

        return matches

    def _clear_states(self):
        self._version = None
        self._proc = None

    def is_https(self):
        cert, key, _ = self.get_server_certificate_files()
        return cert is not None and key is not None

    def get_version(self):
        # Return version if it is cached.
        if self._version is not None:
            return self._version

        if self.is_https():
            server_cert, server_key, ca = self.get_server_certificate_files()
            client_cert, client_key = self.get_client_certificate_files(ca)
            common_name = NuclideCertificatesGenerator.get_common_name(server_cert)
            self._version = utils.http_get(common_name, self.port, method='POST', url='/heartbeat',
                                           key_file=client_key, cert_file=client_cert, ca_cert=ca)
        else:
            self._version = utils.http_get('localhost', self.port, method='POST', url='/heartbeat')
        return self._version

    def _get_proc_info(self):
        if self._proc is None:
            procs = self.get_processes(port=self.port)
            if len(procs) == 1:
                self._proc = procs[0]
            elif len(procs) > 1:
                self.logger.warn('Found more than one Nuclide servers on port %d.' % self.port)
        return self._proc

    # Get cert, key and ca.
    def get_server_certificate_files(self):
        proc = self._get_proc_info()
        if proc is not None:
            cert = proc.get_command_param('cert')
            key = proc.get_command_param('key')
            ca = proc.get_command_param('ca')
            return cert, key, ca
        else:
            return None, None, None

    @staticmethod
    # Given ca path, get client cert and key file paths.
    def get_client_certificate_files(ca):
        # All the certificate/key files share the same prefix "nuclide.random_id".
        # The only differences are the last two parts.
        common_path = os.path.splitext(os.path.splitext(ca)[0])[0]
        return common_path + '.client.crt', common_path + '.client.key'

    def get_common_name(self):
        server_cert, _, _ = self.get_server_certificate_files()
        if server_cert is not None:
            return NuclideCertificatesGenerator.get_common_name(server_cert)
        else:
            return None

    def get_server_info(self):
        output = {'version': self.get_version(), 'port': self.port, 'workspace': self.workspace}
        output['pid'] = self._get_proc_info().get_pid()
        server_cert, server_key, ca = self.get_server_certificate_files()
        if server_cert is not None and server_key is not None and ca is not None:
            client_cert, client_key = self.get_client_certificate_files(ca)
            output['cert'] = self._read_cert_file(client_cert)
            output['key'] = self._read_cert_file(client_key)
            output['ca'] = self._read_cert_file(ca)
            output['ca_path'] = ca
            output['server_cert_path'] = server_cert
            output['server_key_path'] = server_key
            output['hostname'] = NuclideCertificatesGenerator.get_common_name(server_cert)
            output['protocol_version'] = 1
        return output

    # The Nuclide server is healthy and running.
    def is_healthy(self):
        # Version check verifies it runs and has a working endpoint.
        return self.get_version() is not None

    # The Nuclide server process is running.
    def is_running(self):
        return self._get_proc_info() is not None

    # Return whether the user is the owner of the server process.
    def is_mine(self):
        return self._get_proc_info() is not None

    def stop(self):
        proc = self._get_proc_info()
        if proc is None:
            self.logger.error(
                'Tried to stop NuclideServer at port %d, but you are not the owner.' %
                self.port)
            return 1

        try:
            ret = proc.stop()
            if ret == 0:
                self.logger.info('Stopped old Nuclide server on port %d.' % self.port)
            else:
                self.logger.info(
                    'Error occurred when trying to stop old Nuclide server on port {0}.'.format(
                        self.port))
            return ret
        finally:
            self._clear_states()

    def restart(self, timeout):
        self.logger.info('NuclideServer is going to restart.')
        return self.start(timeout, force=True)

    def start(self, timeout, cert=None, key=None, ca=None, force=False,
              quiet=False, debug=False, inspect=False,
              abort_on_uncaught_exception=False,
              expiration_days=None):
        self.logger.info(
            'NuclideServer start/restarting with the following arguments:\n \
             timeout: {0}\n \
             cert:    {1}\n \
             key:     {2}\n \
             ca:      {3}\n \
             force:   {4}\n \
             quiet:   {5}\n \
             debug:   {6}\n \
             inspect: {7}\n \
             expiration_days: {8}'.format(
                 timeout, cert, key, ca, force, quiet, debug, inspect,
                 expiration_days))
        # If one but not all certificate files are given.
        if (cert or key or ca) and not (cert and key and ca):
            self.logger.error('Incomplete certificate files.')

        if self.is_running():
            if force:
                if cert is None or key is None or ca is None:
                    # Grab the existing certificates.
                    cert, key, ca = self.get_server_certificate_files()
                ret = self.stop()
                if ret != 0:
                    return ret
            else:
                self.logger.info('Found existing Nuclide process running on port %d.' % self.port)
                return 1

        node_flags = [
            # Increase stack trace limit for better debug logs.
            # For reference, Atom/Electron does not have a stack trace limit.
            '--stack-trace-limit=50',
        ]

        avail_mem_kb = self._get_avail_memory()
        if not avail_mem_kb or avail_mem_kb >= 8192 * 1024:
            # Increase the default memory limit from ~1.76GB to 4GB.
            node_flags.append('--max-old-space-size=4096')

        # Start Nuclide server.
        js_cmd = '%s %s --port %d' % (' '.join(node_flags), NuclideServer.script_path, self.port)
        if cert and key and ca:
            js_cmd += ' --cert %s --key %s --ca %s' % (cert, key, ca)
        if abort_on_uncaught_exception:
            js_cmd += ' --abort_on_uncaught_exception '
        if expiration_days:
            js_cmd += ' --expiration-days %d ' % expiration_days
        if inspect:
            js_cmd = '--debug ' + js_cmd
        if debug:
            args = shlex.split('node debug %s' % js_cmd)
            p = subprocess.Popen(args)
            p.wait()
        if quiet:
            # No nohup logging.
            # TODO: This is a workaround for testing.
            # When we enable nohup logging, the test or any Python script that calls
            # this script via subprocess.Popen will hang on Popen.communicate().
            args = shlex.split('nohup node %s' % js_cmd)
            with open(os.devnull, "w") as f:
                subprocess.Popen(args, stdout=f, stderr=subprocess.STDOUT)
        else:
            self.logger.info('Opening node server subprocess.')
            p = subprocess.Popen(
                'nohup node %s > %s 2>&1 &' %
                (js_cmd, LOG_FILE), shell=True)

        if not debug:
            self.logger.info('Trying to ping the Nuclide server...')
            for i in range(0, int(timeout / 0.1) + 1):
                # Wait for 100ms and then ping the endpoint for the version.
                running_version = self.get_version()
                if running_version is not None:
                    self.logger.info('Attempted %s pings.', i)
                    self.logger.info('Verified Nuclide started on port %d.' % self.port)
                    return 0
                time.sleep(0.1)

            timeoutMsg = 'Attempted to start Nuclide server on port %d, \
                          but timed out after %d seconds.' % (self.port, timeout)
            self.logger.error(timeoutMsg)
        return 1

    @staticmethod
    def _read_cert_file(file_name):
        with open(file_name, "r") as f:
            text = f.read()
            return text

    @staticmethod
    def _get_avail_memory():
        # /proc/meminfo only exists on Linux.
        if sys.platform.startswith('linux'):
            try:
                with open('/proc/meminfo', 'r') as f:
                    while True:
                        parts = f.readline().split()
                        if len(parts) != 3:
                            break
                        if parts[0] == 'MemAvailable:':
                            # Return value is in kilobytes.
                            return int(parts[1])
            except IOError:
                pass
        return None
