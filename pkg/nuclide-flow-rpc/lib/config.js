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

import type {FlowSettings} from './FlowService';
import invariant from 'assert';

const config: FlowSettings = {
  functionSnippetShouldIncludeArguments: true,
  stopFlowOnExit: true,
  lazyMode: false,
  canUseFlowBin: false,
  // This can be a full path or just a command to run.
  pathToFlow: 'flow',
};

export function getConfig(key: $Keys<typeof config>): mixed {
  return config[key];
}

export function setConfig(key: $Keys<typeof config>, val: mixed): void {
  // Flow's $PropertyType is not powerful enough to express the relationship we want here.
  invariant(typeof val === typeof config[key]);
  config[key] = (val: any);
}
