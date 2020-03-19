# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

import json
import os
import sys


class DummyIOServer:

    def __init__(self):
        self.input_stream = sys.stdin
        self.output_stream = sys.stdout

    def run(self):
        while True:
            line = self.input_stream.readline()
            res = self.process_request(line)
            json.dump(res, self.output_stream)
            # Use \n to signal the end of the response.
            self.output_stream.write('\n')
            self.output_stream.flush()

    def process_request(self, line):
        req = json.loads(line)
        id, data = req['id'], req['args']
        method = req['method']
        res = {
            'protocol': 'service_framework3_rpc',
            'id': id,
        }

        if method == 'kill':
            sys.exit(0)
        elif method == 'error':
            res['type'] = 'error-response'
            res['error'] = 'Command to error received'
        else:
            res['type'] = 'response'
            res['result'] = {
                'hello': 'Hello World'
            }

        return res

if __name__ == '__main__':
    DummyIOServer().run()
