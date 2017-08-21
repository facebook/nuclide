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

export type BaseBuckBuildOptions = {
  install?: boolean,
  run?: boolean,
  test?: boolean,
  debug?: boolean,
  simulator?: ?string,
  // The service framework doesn't support imported types
  commandOptions?: Object /* ObserveProcessOptions */,
  extraArguments?: Array<string>,
};

export type CommandInfo = {
  timestamp: number,
  command: string,
  args: Array<string>,
};

export type ResolvedBuildTarget = {
  qualifiedName: string,
  flavors: Array<string>,
};

export type ResolvedRuleType = {
  type: string,
  buildTarget: ResolvedBuildTarget,
};
