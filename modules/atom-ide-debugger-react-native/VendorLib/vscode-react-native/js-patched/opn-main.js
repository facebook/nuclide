// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

'use strict';
var opn = require('./index.js');

module.exports = function(target, opts, cb) {
    if (process.env.REACT_DEBUGGER) {
        if (opts.app) {
            console.log("Debugger for React Native is configured. Skipping launch of " + opts.app);
        }
        return;
    }

    return opn(target, opts, cb);
};
