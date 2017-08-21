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
/* global XMLHttpRequest, atob */

const {__DEV__} = require('../../nuclide-node-transpiler/lib/env');

if (__DEV__) {
  require('../../nuclide-node-transpiler');
}

/**
 * Override XHR.open to allow this page to be located outside the devtools
 * tree, and resources to be selectively mapped back into the devtools tree.
 */
XMLHttpRequest.prototype.open = (function(original) {
  const unmappedUrlPrefixes = [
    'nuclide_',
  ];
  return function(method, url, async, user, password) {
    let newUrl;
    for (let i = 0; i < unmappedUrlPrefixes.length; i++) {
      if (url.startsWith(unmappedUrlPrefixes[i]) ||
          url.startsWith('./' + unmappedUrlPrefixes[i])) {
        newUrl = url;
      }
    }
    if (!newUrl) {
      newUrl = '../VendorLib/devtools/front_end/' + url;
    }
    return original.call(this, method, newUrl, async, user, password);
  };
})(XMLHttpRequest.prototype.open);

// Originally defined in Runtime.js
window.loadScriptsPromise = (function(original) {
  return function(urls, base) {
    // Prevents the path to the current file to be prepended, so that
    // the overwritten XHR.open can properly prepend the new path prefix.
    const newBase = base === undefined ? './' : base;
    return original(urls, newBase);
  };
})(window.loadScriptsPromise);

// WebInspector.SourceMap indirectly needs this in order to load inline source maps.
window.InspectorFrontendHost = {
  loadNetworkResource(url, headers, streamId, callback) {
    const dataPrefix = 'data:application/json;base64,';
    if (url.startsWith(dataPrefix)) {
      const response = atob(url.slice(dataPrefix.length));
      window.WebInspector.Streams.streamWrite(streamId, response);
      callback({statusCode: 200});
    } else {
      callback({statusCode: 404});
    }
  },
};

// This `require` loading indirection is so that paths are resolved relative to
// where the file is on disk.
window._initializeNuclideBridge = function() {
  require('./nuclide_bridge/NuclideBridge');
  window.WebInspector.NuclideAppProvider =
    require('./nuclide_bridge/NuclideAppProvider').default;
};

window.Runtime.startApplication('nuclide_inspector');
