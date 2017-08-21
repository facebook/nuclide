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

/* eslint-disable no-console */

const Module = require('module');
const profileRequireTime = require('./profile-require-time');

exports.init = function(options_) {
  const options = options_ || {};
  const byRoot = Boolean(options.byRoot);
  const byLoadOrder = Boolean(options.byLoadOrder);
  const loadOrderMinDuration = parseInt(options.loadOrderMinDuration, 10) || 0;
  const customHandler = options.customHandler;

  profileRequireTime.start();

  const onNuclideActivate = atom.packages.onDidActivatePackage(pack => {
    if (pack.name === 'nuclide') {
      onNuclideActivate.dispose();
      const readyTime = pack.activateTime + pack.loadTime;
      const profile = profileRequireTime.stop();
      if (byLoadOrder) {
        printByLoadOrder(readyTime, profile, loadOrderMinDuration);
      }
      if (byRoot) {
        printByRoot(readyTime, profile);
      }
      if (customHandler != null) {
        customHandler(readyTime, profile);
      }
    }
  });
};

function printByLoadOrder(readyTime, profile, minDuration) {
  const data = profile.data;
  const startTime = profile.startTime;
  const stopTime = profile.stopTime;
  console.groupCollapsed('Nuclide ready time: %sms (expand for requires by load order)', readyTime);
  const table = [['order', 'init', 'total', 'depth:filename']];
  Object.keys(data)
    .filter(filename => data[filename].total >= minDuration)
    .sort((a, b) => data[a].order - data[b].order)
    .forEach(filename => {
      const entry = data[filename];
      const shortName = entry.filename.replace(entry.basedir, '');
      table.push([
        entry.order,
        entry.init.toFixed(2) + 'ms',
        entry.total.toFixed(2) + 'ms',
        entry.depth + ':' + leftTruncate(shortName, 70) + (entry.deferred ? '' : '*'),
      ]);
    });
  console.log(
    toTable(table),
    `(${Object.keys(data).length} modules required during ${stopTime - startTime}ms)`
  );
  console.groupEnd();
}

function printByRoot(readyTime, profile) {
  const data = profile.data;
  const startTime = profile.startTime;
  const stopTime = profile.stopTime;
  console.groupCollapsed('Nuclide ready time: %sms (expand for requires by root)', readyTime);
  Object.keys(data)
    .filter(filename => {
      const entry = data[filename];
      const parentFilename = Module._cache[filename].parent.filename;
      return !parentFilename.startsWith(entry.basedir) ||
             parentFilename === module.parent.filename;
    })
    .sort((a, b) => data[a].order - data[b].order)
    .forEach(rootFilename => {
      const rootEntry = data[rootFilename];
      console.group(rootEntry.filename.replace(rootEntry.basedir, ''));
      const table = [['order', 'init', 'total', 'depth:filename']];
      (function traverse(filename) {
        const _entry = data[filename];
        const shortName = _entry.filename.replace(_entry.basedir, '');
        table.push([
          _entry.order,
          _entry.init.toFixed(2) + 'ms',
          _entry.total.toFixed(2) + 'ms',
          _entry.depth + ':' + leftTruncate(shortName, 70) + (_entry.deferred ? '' : '*'),
        ]);
        Module._cache[filename].children.forEach(child => {
          if (child.filename.startsWith(rootEntry.basedir)) {
            traverse(child.filename);
          }
        });
      })(rootEntry.filename);
      console.log(toTable(table));
      console.groupEnd();
    });
  console.log(
    `(${Object.keys(data).length} modules required during ${stopTime - startTime}ms)`
  );
  console.groupEnd();
}

function leftTruncate(str, maxLength) {
  return str.length <= maxLength ? str : '…' + str.substr(-maxLength);
}

function toTable(rows) {
  const maxWidths = [];
  rows.forEach(row => {
    row.forEach((item, i) => {
      maxWidths[i] = Math.max(maxWidths[i] || 0, String(item).length);
    });
  });

  let lines = '';
  rows.forEach(row => {
    row.forEach((item, i) => {
      const padlen = Math.max(maxWidths[i] - String(item).length + 2, 0);
      lines += String(item) + ' '.repeat(padlen);
    });
    lines += '\n';
  });

  return lines;
}
