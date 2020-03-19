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

import nuclideUri from 'nuclide-commons/nuclideUri';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import dedent from 'dedent';
import fs from 'fs';
import nullthrows from 'nullthrows';
// eslint-disable-next-line nuclide-internal/prefer-nuclide-uri
import path from 'path';

const ttfUri = nuclideUri.nuclideUriToUri(
  path.join(__dirname, 'styles', 'nuclicons.ttf'),
);
const newStyle = document.createElement('style');
newStyle.appendChild(
  document.createTextNode(dedent`
    @font-face {
      font-family: 'nuclicons';
      src: url('${ttfUri}') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
  `),
);
nullthrows(document.head).appendChild(newStyle);

const styleDir = path.join(__dirname, 'styles');
const styleDisposables = new UniversalDisposable(
  ...fs
    .readdirSync(styleDir)
    .filter(file => ['.less', '.css'].includes(path.extname(file)))
    .map(file => atom.themes.requireStylesheet(path.join(styleDir, file))),
  () => newStyle.remove(),
);

module.exports = styleDisposables; // eslint-disable-line nuclide-internal/no-commonjs
