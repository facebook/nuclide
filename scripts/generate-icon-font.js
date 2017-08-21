#!/usr/bin/env node
/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @noflow
 */
'use strict';

/* eslint
  comma-dangle: [1, always-multiline],
  prefer-object-spread/prefer-object-spread: 0,
  nuclide-internal/no-commonjs: 0,
  */

const webfontsGenerator = require('webfonts-generator');
const glob = require('glob');
const path = require('path');
const fs = require('fs');

const basedir = path.join(__dirname, '..');
const nucliconsDir = path.join(basedir, 'resources/nuclicons');
const stylesDir = path.join(basedir, 'pkg/nuclide-ui/styles');
const svgs = glob.sync(path.join(basedir, 'resources/nuclicons/*.svg'));

webfontsGenerator(
  {
    files: svgs,
    dest: stylesDir,
    fontName: 'nuclicons',
    cssDest: path.join(stylesDir, 'nuclicons.css'),
    cssTemplate: path.join(nucliconsDir, 'template.css'),
    templateOptions: {
      // Since Atom automatically prefixes classes with "icon-", we need to make sure ours include
      // that prefix.
      classPrefix: 'icon-nuclicon-',
    },
    normalize: true,
    fontHeight: 96,
    ascent: 84,
    // Similar to how Github genereated their fonts for octicons,
    // use `descent` option to set the icon baselines 12px lower so that
    // the generated nuclicons are centered.
    // https://github.com/primer/octicons/blob/v4.4.0/Gruntfile.js#L89-L92
    descent: 12,
    types: ['ttf'],
    rename: basename => basename.match(/\d+-(.*)\.svg/)[1].toLowerCase(),
  },
  err => {
    if (err) {
      throw err;
    } else {
      // webfonts-generator created this file even though we didn't include it in the `types`
      // config. Just delete it.
      fs.unlinkSync(path.join(stylesDir, 'nuclicons.svg'));
    }
  }
);
