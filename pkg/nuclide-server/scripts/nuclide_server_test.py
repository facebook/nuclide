#!/usr/bin/env python

# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

import os
import tempfile
import unittest

from nuclide_certificates_generator import NuclideCertificatesGenerator
from nuclide_server_test_base import NuclideServerTestBase
from nuclide_server import NuclideServer


TIMEOUT = 10


class NuclideServerTest(NuclideServerTestBase):

    def test_multiple_servers(self):
        server_9091 = NuclideServer(9091)
        self.assertEquals(server_9091.start(timeout=TIMEOUT), 0)
        self.assertTrue(server_9091.is_healthy())
        server_9092 = NuclideServer(9092)
        self.assertEquals(server_9092.start(timeout=TIMEOUT), 0)
        self.assertTrue(server_9092.is_healthy())
        # No server on port 9093
        server_9093 = NuclideServer(9093)
        self.assertFalse(server_9093.is_healthy())
        self.assertEquals(server_9091.stop(), 0)
        self.assertFalse(server_9091.is_healthy())
        self.assertTrue(server_9092.is_healthy())

        # Create new server objects to rebind and check states again.
        server_9091 = NuclideServer(9091)
        server_9092 = NuclideServer(9092)
        self.assertFalse(server_9091.is_healthy())
        self.assertTrue(server_9092.is_healthy())

    # Verify Nuclide server can get correct certificates paths.
    def test_get_certificates(self):
        gen = NuclideCertificatesGenerator(tempfile.gettempdir(), 'localhost', 'test')
        server_9091 = NuclideServer(9091)
        ret = server_9091.start(
            timeout=TIMEOUT,
            cert=gen.server_cert,
            key=gen.server_key,
            ca=gen.ca_cert)
        self.assertEquals(ret, 0)
        # Verify cert files.
        server_cert, server_key, ca = server_9091.get_server_certificate_files()
        self.assertEquals(server_cert, gen.server_cert)
        self.assertEquals(server_key, gen.server_key)
        self.assertEquals(ca, gen.ca_cert)
        client_cert, client_key = NuclideServer.get_client_certificate_files(ca)
        self.assertEquals(client_cert, gen.client_cert)
        self.assertEquals(client_key, gen.client_key)
        # Verify same cert files after restart.
        server_9091.restart(timeout=TIMEOUT)
        server_cert, server_key, ca = server_9091.get_server_certificate_files()
        self.assertEquals(server_cert, gen.server_cert)
        self.assertEquals(server_key, gen.server_key)
        self.assertEquals(ca, gen.ca_cert)

    def test_script_name(self):
        self.assertEquals(NuclideServer.script_name, 'nuclide-main.js',
                          'Changing script_name breaks server upgrade.')

    def test_workspace(self):
        # Verify workspace gets resolved to real path.
        workspace = os.path.join(os.getcwd(), '..')
        server = NuclideServer(9091, workspace)
        self.assertEquals(server.workspace, os.path.realpath(workspace))
        # Verify non-existing workspace resolved to None.
        server = NuclideServer(9091, '/lsdkjf')
        self.assertEquals(server.workspace, None)


if __name__ == '__main__':
    unittest.main()
