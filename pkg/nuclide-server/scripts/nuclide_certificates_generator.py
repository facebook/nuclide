#!/usr/bin/env python

# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

from __future__ import print_function

import json
import logging
import optparse
import os
import re
import shlex
import subprocess
import sys
import tempfile

from utils import check_output_silent
from utils import is_ip_address


# SAN = Subject Alternative Name.
OPENSSL_SAN = 'OPENSSL_SAN'
# regex pattern for matching common name.
SUBJECT_CN_REGEX = 'subject=.*/?CN ?= ?([^/\n]*)'


class NuclideCertificatesGenerator(object):
    # openssl config file.
    openssl_cnf = os.path.join(os.path.dirname(__file__), 'openssl.cnf')

    @staticmethod
    def get_text(cert_file):
        return check_output_silent(shlex.split('openssl x509 -noout -text -in %s' % cert_file))

    @staticmethod
    def get_common_name(cert_file):
        args = shlex.split('openssl x509 -noout -subject -in %s' % cert_file)
        p = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        out, err = p.communicate()
        if p.returncode != 0:
            return None

        m = re.match(SUBJECT_CN_REGEX, out)
        if m:
            return m.group(1)
        else:
            return None

    def __init__(self, certs_dir, server_common_name, client_common_name, expiration_days=1):
        self.logger = logging.getLogger('NuclideCertificatesGenerator')

        self._expiration_days = expiration_days
        self._server_common_name = server_common_name
        self._env = os.environ.copy()
        if sys.platform == 'darwin':
            # High Sierra comes with LibreSSL by default.
            # /opt/homebrew/bin sometimes has OpenSSL instead.
            self._env['PATH'] = os.pathsep.join([
                '/opt/homebrew/bin',
                self._env.get('PATH', ''),
            ])
        # Set Subject Alternative Name.
        if is_ip_address(server_common_name):
            self._env[OPENSSL_SAN] = 'IP:%s' % server_common_name
        else:
            # Usually, we don't have to make the common name a SAN,
            # but our openssl.cnf requires a value via $OPENSSL_SAN.
            self._env[OPENSSL_SAN] = 'DNS.1:%s' % server_common_name
        self._client_common_name = client_common_name
        self.ca_key = tempfile.mktemp(dir=certs_dir, suffix='.ca.key', prefix='nuclide.')
        # Get rid of '.ca.key'.
        common_path = os.path.splitext(os.path.splitext(self.ca_key)[0])[0]
        # Generate other file names.
        self.ca_cert = common_path + '.ca.crt'
        self.server_key = common_path + '.server.key'
        # .csr file is intermediate.
        self._server_csr = common_path + '.server.csr'
        self.server_cert = common_path + '.server.crt'
        self.client_key = common_path + '.client.key'
        self._client_csr = common_path + '.client.csr'
        self.client_cert = common_path + '.client.crt'
        self.generate()

    def generate(self):
        if self._generate_ca() and self._generate_key_and_cert_request(
                self.server_key,
                self._server_csr,
                self._server_common_name) and self._generate_certificate(
                self._server_csr,
                self.server_cert,
                1) and self._generate_key_and_cert_request(
                self.client_key,
                self._client_csr,
                self._client_common_name) and self._generate_certificate(
                    self._client_csr,
                    self.client_cert,
                2):
            pass
        else:
            raise RuntimeError('Failed to generate certs.')

    # Generate certificate authority.
    def _generate_ca(self):
        try:
            check_output_silent(shlex.split('openssl genrsa -out %s 1024' % self.ca_key))
            args = shlex.split('openssl req -new -x509 -days %d -key %s -out %s -batch'
                               % (self._expiration_days, self.ca_key, self.ca_cert))
            check_output_silent(args, env=self._env)
        except subprocess.CalledProcessError as e:
            self.logger.error('openssl failed: %s' % e.output)
            return False
        except Exception as e:
            self.logger.error('openssl failed: {0}'.format(e.args))
            return False
        return True

    # Generate a key pair and a certificate signing request.
    def _generate_key_and_cert_request(self, key_file, csr_file, common_name):
        try:
            check_output_silent(shlex.split('openssl genrsa -out %s 1024' % key_file), env=self._env)
            args = shlex.split(
                'openssl req -new -key %s -out %s -subj /CN=%s -config %s' %
                (key_file, csr_file, common_name, NuclideCertificatesGenerator.openssl_cnf))
            check_output_silent(args, env=self._env)
        except subprocess.CalledProcessError as e:
            self.logger.error('openssl failed: %s' % e.output)
            return False
        except Exception as e:
            self.logger.error('openssl failed: {0}'.format(e.args))
            return False
        return True

    # Sign certificate signing request with certificate authority,
    # and generate the certificate.
    def _generate_certificate(self, csr_file, cert_file, serial):
        try:
            # Enable v3_req extensions.
            args = shlex.split(
                'openssl x509 -req -days %d -in %s -CA %s -CAkey %s -set_serial %d -out %s -extensions v3_req -extfile %s' %
                (self._expiration_days,
                 csr_file,
                 self.ca_cert,
                 self.ca_key,
                 serial,
                 cert_file,
                 NuclideCertificatesGenerator.openssl_cnf))
            check_output_silent(args, env=self._env)
        except subprocess.CalledProcessError as e:
            self.logger.error('openssl failed: %s' % e.output)
            return False
        except Exception as e:
            self.logger.error('openssl failed: {0}'.format(e.args))
            return False
        return True


if __name__ == '__main__':
    # The script wrapper of the library is for testing purpose.
    parser = optparse.OptionParser(description='Generate certificates for Nuclide server')

    parser.add_option('-o', '--output_dir', type=str, help='the directory where to generate certs')
    parser.add_option('-s', '--server_common_name', type=str,
                      help='SSL certificate common name for the server, default: %default',
                      default='localhost')
    parser.add_option('-c', '--client_common_name', type=str,
                      help='SSL certificate common name for the client')
    options, args = parser.parse_args(sys.argv[1:])

    generator = NuclideCertificatesGenerator(options.output_dir or tempfile.gettempdir(),
                                             server_common_name=options.server_common_name,
                                             client_common_name=options.client_common_name)

    # Print out the file paths in JSON.
    print(json.dumps({'ca_cert': generator.ca_cert,
                      'server_cert': generator.server_cert, 'server_key': generator.server_key,
                      'client_cert': generator.client_cert, 'client_key': generator.client_key}))
