/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @noflow
 * @format
 */
'use strict';

/* eslint nuclide-internal/no-commonjs: 0 */
/* eslint-disable prefer-arrow-callback */
/* eslint-disable no-var */
/* eslint-disable no-undef */

(function() {
  if (typeof fetch !== 'function') {
    // Your browser is too old...
    return;
  }

  // Not supported on all browsers, but is on modern browsers that
  // will be used by 99% of the people accessing the site.
  var nodeEls = document.getElementsByClassName('node');
  var atomEls = document.getElementsByClassName('atom');
  var nuclideEls = document.getElementsByClassName('nuclide');

  if (!(nodeEls.length > 0 || atomEls.length > 0 || nuclideEls.length > 0)) {
    // Nothing to do in this page...
    return;
  }

  fetch(
    'https://raw.githubusercontent.com/facebook/nuclide/master/package.json',
    {mode: 'cors'},
  )
    .then(function(response) {
      return response.json();
    })
    .then(function(data) {
      // Get the first part that looks like a version...
      var versionLikeRe = /\b\d+\.\d+\.\d+\b/;

      var nodeVersion = data.engines.node.match(versionLikeRe)[0];
      var atomVersion = data.engines.atom.match(versionLikeRe)[0];
      var nuclideVersion = data.version;

      for (var i = 0; i < nodeEls.length; i++) {
        nodeEls.item(i).innerHTML =
          'A Node version that is greater or equal to ' +
          nodeVersion +
          ' is required.';
      }
      for (var j = 0; j < atomEls.length; j++) {
        atomEls.item(j).innerHTML =
          'Nuclide requires an Atom version that is greater or equal to ' +
          atomVersion +
          '.';
      }
      for (var k = 0; k < nuclideEls.length; k++) {
        nuclideEls.item(k).innerHTML =
          'The current version of Nuclide is ' + nuclideVersion + '.';
      }
    });
})();
