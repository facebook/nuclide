#!/usr/bin/env python

# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

import getpass
import json
import os
import socket
import StringIO
import sys
import tempfile
import unittest

import nuclide_server_manager
from nuclide_server_test_base import NuclideServerTestBase
from nuclide_server_manager import NuclideServerManager


WORK_DIR = os.path.dirname(os.path.realpath(__file__))
TARGET_SCRIPT = os.path.join(WORK_DIR, 'nuclide_server_manager.py')


class NuclideServerManagerTest(NuclideServerTestBase):

    def verify_key(self, text):
        self.assertTrue('BEGIN RSA PRIVATE KEY' in text) # nolint
        self.assertTrue('END RSA PRIVATE KEY' in text)

    def verify_cert(self, text):
        self.assertTrue('BEGIN CERTIFICATE' in text)
        self.assertTrue('END CERTIFICATE' in text)

    def start_nuclide_server_and_get_outut(self, args):
        parser = nuclide_server_manager.get_option_parser()
        options, _ = parser.parse_args(args)
        manager = NuclideServerManager(options)

        try:
            # Redirect stdout to a stream for capturing.
            original_stdout = sys.stdout
            sys.stdout = stdout_io = StringIO.StringIO()

            self.assertEquals(manager.start_nuclide(), 0)
            return stdout_io.getvalue()
        finally:
            # Restore stdout.
            sys.stdout = original_stdout

    def start_nuclide_server_and_verify_output(self, args, workspace, port, secure, version=None):
        out = self.start_nuclide_server_and_get_outut(args)
        json_ret = json.loads(out)
        # Verify workspace gets resolved.
        self.assertEquals(os.path.realpath(workspace), json_ret['workspace'])

        if secure:
            self.assertTrue('key' in json_ret)
            self.verify_key(json_ret['key'])
            self.assertTrue('cert' in json_ret)
            self.verify_cert(json_ret['cert'])
            self.assertTrue('ca' in json_ret)
            self.verify_cert(json_ret['ca'])
            hostname = '%s.nuclide.%s' % (getpass.getuser(), socket.gethostname())
            self.assertEquals(hostname, json_ret['hostname'])
        return json_ret['port'], json_ret['version'], json_ret['pid']

    def start_nuclide_server_twice_and_verify(
            self, workspace, port=None, secure=False, upgrade=False):
        args = [TARGET_SCRIPT]
        if port is not None:
            args.append('-p')
            args.append(str(port))

        args.append('-w')
        args.append(workspace)

        # Set timeout
        args.append('-t')
        args.append('10')

        if secure:
            args.append('-d')
            # Send the test certs files to temp dir.
            args.append(tempfile.gettempdir())
        else:
            args.append('-k')

        # Suppress nohup logging.
        # See nuclide_server.py for details.
        args.append('-q')

        # Pick a random version to start with.
        version = 100
        # Generate version file for the mock.
        with open(NuclideServerManager.package_file, 'w') as f:
            json.dump({'version': '0.%s.0' % version}, f)

        # Get the port from the started Nuclide server, and use it in the next step.
        port1, version1, pid1 = self.start_nuclide_server_and_verify_output(
            args, workspace, port, secure)
        self.assertEquals(version1, str(version))
        if port is not None:
            self.assertEquals(port1, port)

        if upgrade:
            # Bump up the version for upgrade.
            version += 1
            with open(NuclideServerManager.package_file, 'w') as f:
                json.dump({'version': '0.%s.0' % version}, f)

        # Try to start Nuclide server again.
        port2, version2, pid2 = self.start_nuclide_server_and_verify_output(
            args, workspace, port1, secure)

        # Verify it returns with same port that is passed in.
        self.assertEquals(port1, port2)

        self.assertEquals(version2, str(version))
        if upgrade:
            self.assertNotEquals(pid1, pid2)
        else:
            self.assertEquals(pid1, pid2)

    def test_nuclide_server_manager_on_http(self):
        self.start_nuclide_server_twice_and_verify(port=9091, workspace='.')
        self.start_nuclide_server_twice_and_verify(port=9092, workspace='..')
        manager = NuclideServerManager({})
        servers = manager.list_servers()
        self.assertEquals(len(servers), 2)
        port0 = servers[0].port
        port1 = servers[1].port
        # A good enough test.
        self.assertEquals(port0 + port1, 9091 + 9092)

    def test_upgrade_on_given_port(self):
        self.start_nuclide_server_twice_and_verify(port=9091, workspace='.', upgrade=True)

    # This tests the find open port feature and uses http.
    def test_find_open_port(self):
        # Without specifying the port, it will find an open port and start the server.
        self.start_nuclide_server_twice_and_verify(workspace='..')

    def test_find_open_port_and_upgrade(self):
        # Nuclide server shall be able to find open port and upgrade it on the same port.
        self.start_nuclide_server_twice_and_verify(workspace='.', upgrade=True)

    def test_nuclide_server_manager_on_https(self):
        self.start_nuclide_server_twice_and_verify(workspace='.', secure=True)
        manager = NuclideServerManager({})
        servers = manager.list_servers()
        self.assertEquals(len(servers), 1)
        # Must be one of the open ports.
        self.assertTrue(servers[0].port in nuclide_server_manager.OPEN_PORTS)

    def test_common_name(self):
        parser = nuclide_server_manager.get_option_parser()
        # Start a Nuclide server using default parameters.
        # It will get a default common name like user.nuclide.host
        options, _ = parser.parse_args([])
        manager = NuclideServerManager(options)
        self.assertEquals(len(manager.list_servers()), 0)
        self.assertEquals(manager.start_nuclide(), 0)
        self.assertEquals(len(manager.list_servers()), 1)
        # Change the default common name and verify it upgrades the existing server.
        options, _ = parser.parse_args(['-n', 'localhost'])
        manager = NuclideServerManager(options)
        self.assertEquals(manager.start_nuclide(), 0)
        servers = manager.list_servers()
        self.assertEquals(len(servers), 1)
        # Verify the new common name.
        self.assertEquals(servers[0].get_common_name(), 'localhost')


if __name__ == '__main__':
    unittest.main()
