/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict
 * @format
 */

// NB: This file exists to make Flow typing with remote objects more ergonomic.
// Because Flow can't deal with exporting a class unless it's part of the
// top-level `module.exports`, it's easier for us to re-export all of `remote`
// instead of doing Weird Backflips every time we want to declare a variable of
// type `BrowserWindow`

import {remote} from 'electron';
module.exports = remote; // eslint-disable-line nuclide-internal/no-commonjs
