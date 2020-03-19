# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

from __future__ import print_function

import httplib
import logging
import os
import re
import socket
import ssl
import subprocess
import sys
import traceback

logger = logging.getLogger('utils')

# Run the process silently without stdout and stderr.
# On success, return stdout. Otherwise, raise CalledProcessError
# with combined stdout and stderr.


def check_output_silent(args, cwd=None, env=None):
    # Use Popen here. check_ouput is not available in Python 2.6.
    # cwd=None means don't change cwd.
    # env=None means inheriting the current process' environment.
    process = subprocess.Popen(
        args,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=cwd,
        env=env)
    out, err = process.communicate()
    if process.returncode != 0:
        error = subprocess.CalledProcessError(process.returncode, args)
        error.output = out + err
        raise error
    else:
        return out


def darwin_path_helper():
    try:
        out = check_output_silent(['/usr/libexec/path_helper', '-s'])
        path = re.search(r'PATH=\"([^\"]+)\"', out).group(1)
        return path
    except Exception as e:
        logger.warn('Failed to get additional PATH info (%s)', e.message)
        return ''


# It supports https if key_file and cert_file are given.
def http_get(host, port, method, url, key_file=None, cert_file=None, ca_cert=None, timeout=1):
    try:
        conn = None
        if key_file is not None and cert_file is not None and ca_cert is not None:
            try:
                ctx = ssl.create_default_context(cafile=ca_cert)
                conn = httplib.HTTPSConnection(
                    host,
                    port,
                    key_file=key_file,
                    cert_file=cert_file,
                    timeout=timeout,
                    context=ctx)
            except (AttributeError, TypeError):
                conn = httplib.HTTPSConnection(
                    host,
                    port,
                    key_file=key_file,
                    cert_file=cert_file,
                    timeout=timeout)
        else:
            conn = httplib.HTTPConnection(host, port, timeout=timeout)
        conn.request(method, url)
        response = conn.getresponse()
        if response.status == 200:
            ret = response.read()
            return ret
        else:
            return None
    except ssl.SSLError as e:
        logger.error('An SSL Error occurred: %s' % traceback.format_exc())
        return None
    except socket.error:
        return None
    except:
        logger.error("Unexpected error: %s" % sys.exc_info()[0])
        return None
    finally:
        if conn:
            conn.close()


def is_ip_address(addr):
    try:
        # Check ipv4 address.
        socket.inet_aton(addr)
        return True
    except socket.error:
        pass

    try:
        # Check ipv6 address.
        socket.inet_pton(socket.AF_INET6, addr)
        return True
    except socket.error:
        return False


# Read the resource and write it to a given dir using the resource name as file name.
# Return the file path.
def write_resource_to_file(name, dir):
    target_path = os.path.join(dir, os.path.basename(name))
    with open(name, 'r') as res_file:
        content = res_file.read()
    with open(target_path, 'w') as f:
        f.write(content)
    return target_path
