#!/usr/bin/env python

# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

import tempfile
import unittest

from nuclide_certificates_generator import NuclideCertificatesGenerator
from utils import write_resource_to_file


class NuclideCertificatesGeneratorTest(unittest.TestCase):
    def setUp(self):
        temp_dir = tempfile.mkdtemp()
        NuclideCertificatesGenerator.openssl_cnf = write_resource_to_file('openssl.cnf', temp_dir)

    def verify_key_file(self, key_file):
        with open(key_file, "r") as f:
            text = f.read()
            self.assertTrue('BEGIN RSA PRIVATE KEY' in text)
            self.assertTrue('END RSA PRIVATE KEY' in text)

    def verify_cert_file(self, cert_file):
        with open(cert_file, "r") as f:
            text = f.read()
            self.assertTrue('BEGIN CERTIFICATE' in text)
            self.assertTrue('END CERTIFICATE' in text)

    def test_cert_gen(self):
        gen = NuclideCertificatesGenerator(tempfile.gettempdir(), 'localhost', 'test')
        self.verify_key_file(gen.ca_key)
        self.verify_cert_file(gen.ca_cert)
        self.verify_key_file(gen.server_key)
        self.verify_cert_file(gen.server_cert)
        self.verify_key_file(gen.client_key)
        self.verify_cert_file(gen.client_cert)
        self.assertEquals(
            'localhost', NuclideCertificatesGenerator.get_common_name(gen.server_cert))

    # Test Subject Alternative Name.
    def test_altnames(self):
        gen = NuclideCertificatesGenerator(tempfile.gettempdir(), '127.0.0.1', 'test')
        text = NuclideCertificatesGenerator.get_text(gen.server_cert)
        self.assertTrue('Subject Alternative Name' in text)
        self.assertTrue('IP Address:127.0.0.1' in text)


if __name__ == '__main__':
    unittest.main()
