# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

import os
import tempfile
import unittest

from nuclide_certificates_generator import NuclideCertificatesGenerator
from nuclide_server import NuclideServer
from nuclide_server_manager import NuclideServerManager
from utils import write_resource_to_file


class NuclideServerTestBase(unittest.TestCase):
    def setUp(self):
        NuclideServerManager.stop_all()

        # Dump resources to files and set up mock files.
        temp_dir = tempfile.mkdtemp()
        NuclideCertificatesGenerator.openssl_cnf = write_resource_to_file('openssl.cnf', temp_dir)
        NuclideServer.script_path = write_resource_to_file('mock/nuclide-main.js', temp_dir)
        # Version file in the same directory as the mock script.
        NuclideServerManager.version_file = os.path.join(temp_dir, 'version.json')

    def tearDown(self):
        NuclideServerManager.stop_all()
