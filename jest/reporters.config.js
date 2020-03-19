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

/*
 * Shared config that contains reporter configuration.
 * We need to include it in global config and project configs
 * (because project configs can run separately)
 */

module.exports = ['default', require.resolve('./analytics_reporter_proxy')];
