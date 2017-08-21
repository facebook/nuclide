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

// Requiring this module will load all stylesheets in styles/.
// The exported value can be disposed to remove the stylesheets.

import {CompositeDisposable} from 'atom';
import fs from 'fs';
// eslint-disable-next-line nuclide-internal/prefer-nuclide-uri
import path from 'path';

const styleDir = path.join(__dirname, 'styles');
const styleDisposables = new CompositeDisposable(
  ...fs
    .readdirSync(styleDir)
    .filter(file => path.extname(file) === '.less')
    .map(file => atom.themes.requireStylesheet(path.join(styleDir, file))),
);

module.exports = styleDisposables; // eslint-disable-line nuclide-internal/no-commonjs
