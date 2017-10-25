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
import logging
import optparse
import os
import re
import resource
import socket
import sys
from collections import defaultdict
import time

from nuclide_server import LOG_FILE
from nuclide_server import NuclideServer
from nuclide_server_logger import configure_nuclide_logger, get_buffered_logs
from nuclide_certificates_generator import NuclideCertificatesGenerator
from process_info import ProcessInfo
from utils import darwin_path_helper


try:
    from fb.nuclide_config import OPEN_PORTS, HOME_FOLDER
except ImportError as e:
    # Default open ports.
    OPEN_PORTS = [9090, 9091, 9092, 9093]
    # Default home folder.
    HOME_FOLDER = os.path.expanduser('~')
    pass

# Minor version is the server protocol version
SEMVERISH_RE = re.compile(r'^(\d+)\.(\d+)\.(\d+)(?:-([a-z0-9.-]+))?$')

# Certificates store is ~/.certs
CERTS_DIR = os.path.join(HOME_FOLDER, '.certs')
CERTS_EXPIRATION_DAYS = 14

# Default core dump location on Linux machines.
CORE_DUMP_PATH = '/var/tmp/cores'
MAX_CORE_DUMPS = 3


# This class manages Nuclide servers.


class NuclideServerManager(object):
    package_file = os.path.join(
        os.path.dirname(__file__),
        '../../../package.json')
    logger = logging.getLogger('NuclideServerManager')

    def __init__(self, options):
        self.options = options
        self.logger.info('NuclideServerManager was created with these options: {0}'.format(options))

    def _check_port_family(self, port, family):
        s = socket.socket(family, socket.SOCK_STREAM)
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

    def _is_port_open(self, port):
        return self._check_port_family(port, socket.AF_INET) and\
            self._check_port_family(port, socket.AF_INET6)

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
            with open(NuclideServerManager.package_file) as f:
                package_json = json.load(f)
        except IOError as e:
            NuclideServerManager.logger.error('No package.json. Skip version verification.')
        except (KeyError, ValueError) as e:
            NuclideServerManager.logger.error('Corrupted package.json. Skip version verification.')
        try:
            match = SEMVERISH_RE.match(package_json['version'])
            version = match.group(2)
        except:
            NuclideServerManager.logger.error('Bad version. Skip version verification.')
        return version

    def _ensure_certs_dir(self):
        self.logger.info('Checking if certificate dir {0} exists.'.format(CERTS_DIR))
        if not os.path.exists(CERTS_DIR):
            self.logger.info('Creating certificates dir.')
            os.makedirs(CERTS_DIR)
        return CERTS_DIR

    def _check_if_certs_files_exist(self, certs_generator):
        server_cert_exists = os.path.exists(certs_generator.server_cert)
        server_key_exists = os.path.exists(certs_generator.server_key)
        ca_cert_exists = os.path.exists(certs_generator.ca_cert)
        if server_cert_exists and server_key_exists and ca_cert_exists:
            return True
        else:
            message = 'The expected generated certificate files do not exist:'
            if not server_cert_exists:
                message += '\n server cert: {0}'.format(certs_generator.server_cert)
            if not server_key_exists:
                message += '\n server key: {0}'.format(certs_generator.server_key)
            if not ca_cert_exists:
                message += '\n ca cert: {0}'.format(certs_generator.ca_cert)
            self.logger.error(message)
            return False

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
            self.logger.info('Cleaning up old certificate files...')
            certs_dir = self.options.certs_dir or CERTS_DIR
            current = time.time()
            seconds_to_keep = 3600 * 24 * days_to_keep
            for file in glob.glob(os.path.join(certs_dir, 'nuclide*')):
                if current - os.path.getmtime(file) > seconds_to_keep:
                    self.logger.info('Deleting certificate file: {0}'.format(file))
                    os.unlink(file)
        except Exception as e:
            self.logger.error('Error in cleaning up certificates: %s' % e)

    # Clean up bad processes and old files.
    def cleanup(self):
        self.logger.info('Starting to clean up old Nuclide processes/files.')
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
                self.logger.warning(
                    'Multiple Nuclide processes on port %d. Something wrong. Clean them up...' %
                    port)
                for proc in server_proc_map[port]:
                    proc.stop()

        self.cleanup_certificates(CERTS_EXPIRATION_DAYS)
        self.logger.info('Finished cleaning up old Nuclide processes/files.')

    # Find and use existing Nuclide server's port if there is a match,
    # or obtain an open port.
    def _obtain_nuclide_server_port(self):
        servers = self.list_servers(port_filter=OPEN_PORTS)
        if len(servers) > 0:
            for server in servers:
                # Return existing server port if the protocol matches.
                if server.is_https() == (not self.options.insecure):
                    self.logger.info(
                        'Found existing Nuclide server on port: {0}'.format(
                            server.port))
                    return server.port

        # If no existing servers, find an open port.
        port = self._find_open_port()
        if port is None:
            self.logger.warn('No open ports available.')
            return None
        else:
            self.logger.info('Found an open port: {0}.'.format(port))
            return port

    def start_nuclide(self):
        server = None
        self.logger.info('Trying to determine the port to use for Nuclide server...')
        if self.options.port is None:
            port = self._obtain_nuclide_server_port()
            if port is None:
                self.logger.error(
                    'Failed to start Nuclide server because there are no ports available.')
                return {'exit_code': 1, 'server': server}
        else:
            self.logger.error('The user specified port {0}.'.format(self.options.port))
            port = self.options.port

        server = NuclideServer(port, self.options.workspace)
        self.logger.info('Initialized NuclideServer.')

        # If given port is being used by somebody else, you shall not pass.
        if not self._is_port_open(port) and not server.is_mine():
            self.logger.error(
                'You are not the owner of Nuclide server at port %d. Try a different port.' %
                port)
            return {'exit_code': 1, 'server': server}

        # At this moment, the port is either open, or we have an existing server running.
        if not server.is_running():
            return {'exit_code': self.start_server(server), 'server': server}

        version = NuclideServerManager._get_version()
        running_version = server.get_version()
        self.logger.info('A Nuclide server is already running. \
                          Running version: {0}. Desired version: {1}.'.format(running_version, version))
        # If the common names don't match, we restart.
        if (version and version != running_version) or (
                self.options.common_name and server.get_common_name() != self.options.common_name):
            self.logger.info('Restarting Nuclide server on port %d' % port)
            server.stop()
            # Don't use restart() here, so that we regenerate the certificates.
            return {'exit_code': self.start_server(server), 'server': server}
        else:
            self.logger.info(
                'Nuclide server already running on port %d. User may connect.' %
                port)
            return {'exit_code': 0, 'server': server}

    def start_server(self, server):
        self.logger.info('Starting NuclideServer...')
        if self.options.insecure:
            # Use http.
            self.logger.info('Using http.')
            return server.start(
                self.options.timeout,
                quiet=self.options.quiet,
                debug=self.options.debug,
                inspect=self.options.inspect,
                abort_on_uncaught_exception=self.options.dump_core)
        else:
            # Use https.
            self.logger.info('Using https.')
            certs_dir = self.options.certs_dir or self._ensure_certs_dir()
            # Add prefix "user.nuclide" to avoid collision.
            common_name = self.options.common_name or \
                '%s.nuclide.%s' % (getpass.getuser(), socket.gethostname())

            # TODO: Client common name is 'nuclide'.
            # We may want to generate unique common name and verify it.
            certs_generator = NuclideCertificatesGenerator(certs_dir, common_name, 'nuclide',
                                                           expiration_days=CERTS_EXPIRATION_DAYS)
            self.logger.info(
                'Initialized NuclideCertificatesGenerator with common_name: {0}'.format(common_name))
            self._check_if_certs_files_exist(certs_generator)
            return server.start(
                self.options.timeout,
                cert=certs_generator.server_cert,
                key=certs_generator.server_key,
                ca=certs_generator.ca_cert,
                quiet=self.options.quiet,
                debug=self.options.debug,
                inspect=self.options.inspect,
                abort_on_uncaught_exception=self.options.dump_core,
                # After the server certificate expires, clients won't be able to connect.
                # Automatically exit to avoid zombie servers.
                expiration_days=CERTS_EXPIRATION_DAYS + 1)


def get_option_parser():
    parser = optparse.OptionParser(description='Nuclide server manager')
    parser.add_option('-p', '--port', type=int, help='port number')
    parser.add_option(
        '-k',
        '--insecure',
        help='use http instead of https',
        action='store_true',
        default=False)
    # Don't set default value of certs_dir, so that we can just check certs_dir for None.
    parser.add_option(
        '-d',
        '--certs-dir',
        type=str,
        help='directory to store certificate files, default: ~/.certs')
    parser.add_option('-n', '--common-name', type=str, help='the common name to use in certificate')
    parser.add_option(
        '-t',
        '--timeout',
        type=int,
        help='timeout in seconds, default: %default',
        default=10)
    parser.add_option('-w', '--workspace', type=str, help='the workspace directory')
    parser.add_option(
        '-c',
        '--command',
        type=str,
        help='commands: list, start, stopall; default: %default',
        default='start')
    parser.add_option(
        '-q',
        '--quiet',
        help='suppress nohup logging',
        action='store_true',
        default=False)
    parser.add_option(
        '--debug',
        help='Start in debugger. Only use this flag interactively',
        action='store_true',
        default=False)
    parser.add_option(
        '--inspect',
        help='Start remote debugger on port 5858',
        action='store_true',
        default=False)
    parser.add_option(
        '-v',
        '--verbose',
        help='Print info/errors into stdout',
        action='store_true',
        default=False)
    parser.add_option(
        '--dump-core',
        help='Dump core file when uncaught exception or abort',
        action="store_true",
        default=True)
    parser.add_option(
        '-j',
        '--json-output-file',
        type=str,
        help='Save json format output into a file, only for `start` command',
        default=None)
    return parser


if __name__ == '__main__':
    parser = get_option_parser()
    options, args = parser.parse_args(sys.argv[1:])

    configure_nuclide_logger(options.verbose)

    logger = logging.getLogger()
    logger.info('Invoked nuclide_server_manager...')

    if sys.platform == 'darwin':
        os.environ['PATH'] = darwin_path_helper() + os.pathsep + os.environ.get('PATH', '')

    manager = NuclideServerManager(options)
    manager.cleanup()

    # Enable core dump by change ulimit to infinity.
    if options.dump_core:
        try:
            _, hard_limit = resource.getrlimit(resource.RLIMIT_CORE)
            resource.setrlimit(resource.RLIMIT_CORE, (resource.RLIM_INFINITY, hard_limit))
        except Exception as e:
            logger.warn('Failed to enable core dump (%s)' % e)

    # Clean up old core dumps. They're pretty large, so don't hog disk space.
    try:
        # By default, node core dumps are saved as 'node.<pid>'.
        # We can't be sure that these were actually Nuclide dumps, but they're temporary anyway.
        cores = filter(lambda x: x.startswith('node.'), os.listdir(CORE_DUMP_PATH))
        if len(cores) > MAX_CORE_DUMPS:
            cores = map(lambda f: os.path.join(CORE_DUMP_PATH, f), cores)
            # Remove the oldest core dumps first.
            cores.sort(key=lambda f: os.stat(f).st_ctime)
            for core in cores[:len(cores) - MAX_CORE_DUMPS]:
                os.remove(core)
    except Exception as e:
        logger.warn('Failed to clean up old core dumps (%s)' % e)
        pass

    if options.command == 'start':
        server_start_result = manager.start_nuclide()
        ret = server_start_result['exit_code']
        if ret == 0:
            server = server_start_result['server']
            result = server.get_server_info()
            result['success'] = True
        else:
            result = {'success': False, 'logs': get_buffered_logs()}

        if options.json_output_file:
            with open(options.json_output_file, 'w') as f:
                json.dump(result, f)
        else:
            print(json.dumps(result))
        print('The log file can be found at %s.' % LOG_FILE, file=sys.stderr)
    elif options.command == 'list' or options.command == 'listall':
        if options.command == 'listall':
            # List processes for all users.
            servers = manager.list_servers(user=None)
        else:
            servers = manager.list_servers()
        for server in servers:
            print(json.dumps(server.get_server_info()))
        ret = 0
        print('The log file can be found at %s.' % LOG_FILE, file=sys.stderr)
    elif options.command == 'stopall':
        manager.stop_all()
        ret = 0
    else:
        print('Unrecognized command: %s' % options.command, file=sys.stderr)
        logger.error('Unrecognized command: %s' % options.command)
        ret = 1
    sys.exit(ret)
