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

import {getInstance} from './MerlinProcess';

export type MerlinPosition = {
  line: number, // 1-indexed
  col: number, // 0-indexed
};

export type MerlinType = {
  start: MerlinPosition,
  end: MerlinPosition,
  type: string,
  tail: 'no' | 'position' | 'call',
};

export type MerlinError = {
  start?: MerlinPosition,
  end?: MerlinPosition,
  valid: boolean,
  message: string,
  type: 'type' | 'parser' | 'env' | 'warning' | 'unknown',
};

export type MerlinOutline = {
  start: MerlinPosition,
  end: MerlinPosition,
  kind: string,
  name: string,
  children: Array<MerlinOutline>,
};

export type MerlinCases = [
  {
    start: MerlinPosition,
    end: MerlinPosition,
  },
  // this is the content to replace the start-end by. Merlin has an awkawrd API
  // for case analysis.
  string,
];

export type MerlinOccurrences = Array<{
  start: MerlinPosition,
  end: MerlinPosition,
}>;

export async function pushDotMerlinPath(path: NuclideUri): Promise<?any> {
  const instance = await getInstance(path);
  return instance ? instance.pushDotMerlinPath(path) : null;
}

export async function pushNewBuffer(
  name: NuclideUri,
  content: string,
): Promise<?any> {
  const instance = await getInstance(name);
  return instance ? instance.pushNewBuffer(name, content) : null;
}

export async function locate(
  path: NuclideUri,
  line: number,
  col: number,
  kind: string,
): Promise<?{
  file: NuclideUri,
  pos: {
    line: number,
    col: number,
  },
}> {
  const instance = await getInstance(path);
  return instance ? instance.locate(path, line, col, kind) : null;
}

/**
 * Returns a list of all expression around the given position.
 * Results will be ordered in increasing size (so the best guess will be first).
 */
export async function enclosingType(
  path: NuclideUri,
  line: number,
  col: number,
): Promise<?Array<MerlinType>> {
  const instance = await getInstance(path);
  return instance ? instance.enclosingType(path, line, col) : null;
}

export async function complete(
  path: NuclideUri,
  line: number,
  col: number,
  prefix: string,
): Promise<any> {
  const instance = await getInstance(path);
  return instance ? instance.complete(path, line, col, prefix) : null;
}

export async function errors(path: NuclideUri): Promise<?Array<MerlinError>> {
  const instance = await getInstance(path);
  return instance ? instance.errors(path) : null;
}

export async function outline(
  path: NuclideUri,
): Promise<?Array<MerlinOutline>> {
  const instance = await getInstance(path);
  return instance ? instance.outline(path) : null;
}

export async function cases(
  path: NuclideUri,
  position: atom$Point,
): Promise<?MerlinCases> {
  const instance = await getInstance(path);
  if (!instance) {
    return null;
  }
  const result = await instance.enclosingType(
    path,
    position.row,
    position.column,
  );
  if (result && result[0]) {
    return instance.cases(path, result[0].start, result[0].end);
  }
  return null;
}

// This is currently unused; waiting for the refactoring front-end to finish.
export async function occurrences(
  path: NuclideUri,
  position: atom$Point,
): Promise<?MerlinOccurrences> {
  const instance = await getInstance(path);
  return instance
    ? instance.occurrences(path, position.row, position.column)
    : null;
}

/**
 * Low-level API into merlin service useful for debugging and for prototyping
 * on top of bleeding edge Merlin branches.
 */
export async function runSingleCommand(
  path: NuclideUri,
  command: mixed,
): Promise<any> {
  const instance = await getInstance(path);
  return instance ? instance.runSingleCommand(command, path) : null;
}
