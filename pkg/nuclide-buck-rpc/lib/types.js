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

import type {ClangCompilationDatabase} from '../../nuclide-clang-rpc/lib/rpc-types';

// Tag Buck calls as coming from Nuclide for analytics purposes.
export const CLIENT_ID_ARGS = ['--config', 'client.id=nuclide'];

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

export type BuckClangCompilationDatabase = {|
  file: ?string,
  flagsFile: ?string,
  libclangPath: ?string,
  warnings: Array<string>,
  target?: string,
|};

// Remove the warnings field from the buck value.
export function convertBuckClangCompilationDatabase(
  buckDb: ?BuckClangCompilationDatabase,
): ?ClangCompilationDatabase {
  if (buckDb != null) {
    const {file, flagsFile, libclangPath} = buckDb;
    return {file, flagsFile, libclangPath};
  }
  return null;
}
