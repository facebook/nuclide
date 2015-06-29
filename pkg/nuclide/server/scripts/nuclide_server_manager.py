#!/usr/bin/env python

# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

from __future__ import print_function

import getpass
import glob
import json
import optparse
import os
import re
import shlex
import subprocess
import socket
import sys
import tempfile
import time

from collections import defaultdict
from nuclide_server import LOG_FILE
from nuclide_server import NuclideServer
from nuclide_certificates_generator import NuclideCertificatesGenerator
from process_info import ProcessInfo

try:
    from fb.nuclide_config import EXTRA_NODE_PATHS, OPEN_PORTS
except ImportError as e:
    # Default extra $PATH elements for Node v0.12.
    EXTRA_NODE_PATHS = []
    # Default open ports.
    OPEN_PORTS = [9090, 9091, 9092, 9093]
    pass

# Certificates store is ~/.certs
CERTS_DIR = os.path.join(os.path.expanduser('~'), '.certs')
CERTS_EXPIRATION_DAYS = 7
NODE_PATHS = EXTRA_NODE_PATHS + ['/opt/local/bin', '/usr/local/bin']

# This class manages Nuclide servers.
class NuclideServerManager(object):

    version_file = os.path.join(os.path.dirname(__file__), '../node_modules/nuclide-version/version.json')

    def __init__(self, options):
        self.options = options

    def _is_port_open(self, port):
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            # If you can connect socket, that means the somebody is listening to the port.
            # Therefore, the port is not available for Nuclide server.
            # connect requires the address in tuple format (address, port).
            # That's why the double () below.
            s.connect(('localhost', port))
            s.shutdown(socket.SHUT_RDWR)
            return False
        except socket.error:
            return True

    def _find_open_port(self):
        for port in OPEN_PORTS:
            if self._is_port_open(port):
                return port
        return None

    # Get the protocol version of the build.
    @staticmethod
    def _get_version():
        # Read version from version file if it exists.
        # Otherwise, skip version checking.
        version = None
        try:
            with open(NuclideServerManager.version_file) as f:
                version_json = json.load(f)
            version = str(version_json['Version'])
        except IOError as e:
            print('No version.json. Skip version verification.', file=sys.stderr)
        except (KeyError, ValueError) as e:
            print('Corrupted version.json. Skip version verification.', file=sys.stderr)
        return version

    def _ensure_certs_dir(self):
        if not os.path.exists(CERTS_DIR):
            os.makedirs(CERTS_DIR)
        return CERTS_DIR

    # If port_filter is given, only list servers in that list.
    @staticmethod
    def list_servers(user=getpass.getuser(), port_filter=[]):
        servers = []
        for proc in NuclideServer.get_processes(user):
            port = int(proc.get_command_param('port'))
            if not port_filter or port in port_filter:
                server = NuclideServer(port, proc=proc)
                servers.append(server)
        return servers

    @staticmethod
    def stop_all():
        for server in NuclideServerManager.list_servers():
            server.stop()

    def cleanup_certificates(self, days_to_keep):
        try:
            print('Cleaning up old files...', file=sys.stderr)
            certs_dir = self.options.certs_dir or self._ensure_certs_dir()
            current = time.time()
            seconds_to_keep = 3600 * 24 * days_to_keep
            for file in glob.glob(os.path.join(certs_dir, 'nuclide*')):
                if current - os.path.getmtime(file) > seconds_to_keep:
                    os.unlink(file)
        except Exception as e:
            print('Error in cleaning up certificates: %s' % e)

    # Clean up bad processes and old files.
    def cleanup(self):

        # TODO: Remove it after migration is complete.
        # For migration, stop the forever monitor processes of Nuclide server.
        # This does not stop existing Nuclide server processes themselves.
        # It just removes the monitor so that we can kill them on upgrade.
        for proc in ProcessInfo.get_processes(getpass.getuser(),
            '%s.*%s' % (re.escape('forever/bin/monitor'), re.escape('nuclide-main.js'))):
            print('Stopping %s' % proc, file=sys.stderr)
            proc.stop()

        # Clean up multiple Nuclide processes on same port.
        # There should be no more than one on a given port.
        # TODO: log the error to analytics db.
        # { port1 => [proc1, proc2, ...], ...}
        server_proc_map = defaultdict(list)
        # Group the processes by port.
        for proc in NuclideServer.get_processes():
            port = int(proc.get_command_param('port'))
            server_proc_map[port].append(proc)
        for port in server_proc_map:
            if len(server_proc_map[port]) > 1:
                print('Multiple Nuclide processes on port %d. Something wrong. Clean them up...' % port, file=sys.stderr)
                for proc in server_proc_map[port]:
                    proc.stop()

        self.cleanup_certificates(CERTS_EXPIRATION_DAYS)

    # Find and use existing Nuclide server's port if there is a match,
    # or obtain an open port.
    def _obtain_nuclide_server_port(self):
        servers = self.list_servers(port_filter=OPEN_PORTS)
        if len(servers) > 0:
            for server in servers:
                # Return existing server port if the protocol matches.
                if server.is_https() == (not self.options.insecure):
                    return server.port

        # If no existing servers, find an open port.
        port = self._find_open_port()
        if port is None:
            print('No ports available.', file=sys.stderr)
            return None
        else:
            return port

    def start_nuclide(self):
        if self.options.port is None:
            port = self._obtain_nuclide_server_port()
            if port is None:
                return 1
        else:
            port = self.options.port

        server = NuclideServer(port, self.options.workspace)

        # If given port is being used by somebody else, you shall not pass.
        if not self._is_port_open(port) and not server.is_mine():
            print('You are not the owner of Nuclide server at port %d. Try a different port.' %
                port, file=sys.stderr)
            return 1

        # At this moment, the port is either open, or we have an existing server running.
        if server.is_running():
            version = NuclideServerManager._get_version()
            running_version = server.get_version()
            # If the common names don't match, we restart.
            if (version and version != running_version) or \
                (self.options.common_name and server.get_common_name() != self.options.common_name):
                print('Restarting Nuclide server on port %d' % port, file=sys.stderr)
                server.stop()
                return self.start_server(server)
                # Don't use restart() here, so that we regenerate the certificates.
            else:
                print('Nuclide already running on port %d. You may connect.' % port, file=sys.stderr)
                server.print_json()
                return 0
        else:
            return self.start_server(server)

    def start_server(self, server):
        print('Starting Nuclide server...', file=sys.stderr)
        if self.options.insecure:
            # Use http.
            return server.start(self.options.timeout, quiet=self.options.quiet)
        else:
            # Use https.
            certs_dir = self.options.certs_dir or self._ensure_certs_dir()
            # Add prefix "user.nuclide" to avoid collision.
            common_name = self.options.common_name or \
                '%s.nuclide.%s' % (getpass.getuser(), socket.gethostname())

            # TODO: Client common name is 'nuclide'.
            #       We may want to generate unique common name and verify it.
            certs_generator = NuclideCertificatesGenerator(certs_dir, common_name, 'nuclide', expiration_days=CERTS_EXPIRATION_DAYS)
            return server.start(self.options.timeout, cert=certs_generator.server_cert,
                key=certs_generator.server_key, ca=certs_generator.ca_cert, quiet=self.options.quiet)

def get_option_parser():
    parser = optparse.OptionParser(description='Nuclide server manager')
    parser.add_option('-p', '--port', type=int, help='port number')
    parser.add_option('-k', '--insecure', help='use http instead of https', action="store_true", default=False)
    # Don't set default value of certs_dir, so that we can just check certs_dir for None.
    parser.add_option('-d', '--certs_dir', type=str, help='directory to store certificate files, default: ~/.certs')
    parser.add_option('-n', '--common_name', type=str, help='the common name to use in certificate')
    parser.add_option('-t', '--timeout', type=int, help='timeout in seconds, default: %default', default=10)
    parser.add_option('-w', '--workspace', type=str, help='the workspace directory')
    parser.add_option('-c', '--command', type=str, help='commands: list, start, stopall; default: %default', default='start')
    parser.add_option('-q', '--quiet', help='suppress nohup logging', action="store_true", default=False)
    return parser

if __name__ == '__main__':
    os.environ['PATH'] = os.pathsep.join(NODE_PATHS) + os.pathsep + os.environ.get('PATH', '')
    parser = get_option_parser()
    options, args = parser.parse_args(sys.argv[1:])

    manager = NuclideServerManager(options)
    manager.cleanup()
    if options.command == 'start':
        ret = manager.start_nuclide()
        print('The log file can be found at %s.' % LOG_FILE, file=sys.stderr)
    elif options.command == 'list' or options.command == 'listall':
        if options.command == 'listall':
            # List processes for all users.
            servers = manager.list_servers(user=None)
        else:
            servers = manager.list_servers()
        for server in servers:
            server.print_json()
        ret = 0
        print('The log file can be found at %s.' % LOG_FILE, file=sys.stderr)
    elif options.command == 'stopall':
        manager.stop_all()
        ret = 0
    else:
        print('Unrecognized command: %s' % options.command, file=sys.stderr)
        ret = 1
    sys.exit(ret)
