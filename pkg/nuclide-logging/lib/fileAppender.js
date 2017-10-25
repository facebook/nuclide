/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 */

// eslint-disable-next-line rulesdir/no-commonjs
const fileAppender = require('log4js/lib/appenders/file');

// The log4js file appender shutdown function doesn't wait for writes to complete.
// To circumvent this, replace the shutdown handler with a simple delay.
// TODO(hansonw): remove this when log4js 2.x is released.
fileAppender.shutdown = cb => setTimeout(cb, 100);

// eslint-disable-next-line rulesdir/no-commonjs
module.exports = fileAppender;
