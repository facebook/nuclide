/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @noflow
 * @format
 */
'use strict';

/* eslint nuclide-internal/no-commonjs: 0 */

// Have to make sure to use the transpiler or else we'll crash as soon as we try
// to `import` from within OcamlDebugger.js.
const fs = require('fs');
const path = require('path');
if (fs.existsSync(path.join(__dirname, '../DEVELOPMENT'))) {
  // eslint-disable-next-line nuclide-internal/modules-dependencies
  require('nuclide-node-transpiler');
}
require('./OCamlDebugger');
