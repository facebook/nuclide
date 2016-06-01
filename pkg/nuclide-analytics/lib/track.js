'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

export type TrackEvent = {
  key: string;
  values: {[key: string]: mixed};
};

// This extra module enables adding spies during testing.
export let track;
try {
  // $FlowFB
  track = require('../fb/analytics').track;
} catch (e) {
  track = require('./analytics').track;
}
