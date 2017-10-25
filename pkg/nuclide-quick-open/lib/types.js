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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import * as React from 'react';

export type CommandResult = {
  resultType: 'COMMAND',
  callback?: () => mixed,
};

export type SymbolResult = {
  resultType: 'SYMBOL',
  path: NuclideUri,
  line: number,
  column: number,
  name: string,
  containerName: ?string,
  icon: ?string, // from https://github.com/atom/atom/blob/master/static/octicons.less
  hoverText: ?string, // sometimes used to explain the icon in words
};

export type FileResult = {
  resultType: 'FILE',
  path: NuclideUri,
  matchIndexes?: Array<number>,
  score?: number,
  // The original query that prompted this result, e.g. to highlight it in the UI.
  query?: string,
  context?: string,
  timestamp?: number,
  // Jump to line/column if provided.
  line?: number,
  column?: number,
  // A custom callback to perform upon selection.
  callback?: () => mixed,
};

export type ProviderResult = CommandResult | FileResult | SymbolResult;

export type DirectoryProviderType<T: ProviderResult> = {
  providerType: 'DIRECTORY',
  name: string,
  debounceDelay?: number,
  display?: {
    title: string,
    prompt: string,
    action?: string,
    canOpenAll?: boolean,
  },
  priority?: number,
  isEligibleForDirectory(directory: atom$Directory): Promise<boolean>,
  executeQuery(query: string, directory: atom$Directory): Promise<Array<T>>,
  getComponentForItem?: (item: T) => React.Element<any>,
};

export type GlobalProviderType<T: ProviderResult> = {
  providerType: 'GLOBAL',
  name: string,
  debounceDelay?: number,
  display?: {
    title: string,
    prompt: string,
    action?: string,
    canOpenAll?: boolean,
  },
  priority?: number,
  isEligibleForDirectories(
    directories: Array<atom$Directory>,
  ): Promise<boolean>,
  executeQuery(
    query: string,
    directories: Array<atom$Directory>,
  ): Promise<Array<T>>,
  getComponentForItem?: (item: T) => React.Element<any>,
};

export type Provider<T: ProviderResult> =
  | DirectoryProviderType<T>
  | GlobalProviderType<T>;
