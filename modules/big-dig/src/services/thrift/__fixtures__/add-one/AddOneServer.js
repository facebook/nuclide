/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

/* eslint-disable nuclide-internal/no-commonjs */

const thrift = require('thrift');
const AddOne = require('./gen-nodejs/AddOne');

const server = thrift.createServer(AddOne, {
  calc(n1) {
    return n1 + 1;
  },
});

server.listen(process.argv[2]);
