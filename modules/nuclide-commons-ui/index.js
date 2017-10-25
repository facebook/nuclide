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

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import fs from 'fs';
// eslint-disable-next-line rulesdir/prefer-nuclide-uri
import path from 'path';

const styleDir = path.join(__dirname, 'styles');
const styleDisposables = new UniversalDisposable(
  ...fs
    .readdirSync(styleDir)
    .filter(file => ['.less', '.css'].includes(path.extname(file)))
    .map(file => atom.themes.requireStylesheet(path.join(styleDir, file))),
);

module.exports = styleDisposables; // eslint-disable-line rulesdir/no-commonjs
