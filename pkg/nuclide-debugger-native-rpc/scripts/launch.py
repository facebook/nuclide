# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

import os
import sys
import socket

# Remove launch.py from argv
sys.argv.pop(0)

# Remove the port Nuclide is listening on from argv
nuclide_port = sys.argv.pop(0)

# Connect to Nuclide and let it know this process ready.
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.connect(('127.0.0.1', int(nuclide_port)))

# Write our current process ID into the socket. Nuclide will use
# this pid for attach.
sock.sendall(str(os.getpid()))

# Our contract with Nuclide is we block here on this socket until
# Nuclide has attached a debugger. Nuclide will write data into
# this socket to unblock the following read when it is safe to proceed
# Doesn't matter what the data is, this is just for synchronization.
try:
    sock.recv(1024)
except socket.error:
    pass

sock.close()

# Invoke execv which will replace this process with the target.
# Note: this call does not return.
os.execv(sys.argv[0], sys.argv)

# Unreachable.
