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

/* eslint comma-dangle: [1, always-multiline], prefer-object-spread/prefer-object-spread: 0 */

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

  if (!(nodeEls || atomEls || nuclideEls)) {
    // Nothing to do in this page...
    return;
  }

  fetch(
    'https://raw.githubusercontent.com/facebook/nuclide/master/package.json',
    {mode:'cors'}
  ).then(function(response) {
    return response.json();
  }).then(function(data) {
    // Get the first part that looks like a version...
    var versionLikeRe = /\b\d+\.\d+\.\d+\b/;

    var nodeVersion = data.engines.node.match(/\b\d+\.\d+\.\d+\b/)[0];
    var atomVersion = data.engines.atom.match(/\b\d+\.\d+\.\d+\b/)[0];
    var nuclideVersion = data.version;

    if (nodeEls) {
      for (var i = 0; i < nodeEls.length; i++) {
        nodeEls.item(i).innerHTML =
          'A Node version that is greater or equal to ' + nodeVersion + ' is required.';
      }
    }
    if (atomEls) {
      for (var i = 0; i < atomEls.length; i++) {
        atomEls.item(i).innerHTML =
          'Nuclide requires an Atom version that is greater or equal to ' + atomVersion + '.';
      }
    }
    if (nuclideEls) {
      for (var i = 0; i < nuclideEls.length; i++) {
        nuclideEls.item(i).innerHTML =
          'The current version of Nuclide is ' + nuclideVersion + '.';
      }
    }
  });
})();
