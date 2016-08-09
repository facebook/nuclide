'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {NuclideUri} from '../../commons-node/nuclideUri';

import {getInstance} from './MerlinProcess';

export type MerlinPosition = {
  line: number, // 1-indexed
  col: number,  // 0-indexed
};

export type MerlinType = {
  start: MerlinPosition,
  end: MerlinPosition,
  type: string,
  tail: 'no' | 'position' | 'call',
};

export type MerlinError = {
  start: MerlinPosition,
  end: MerlinPosition,
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

export async function pushDotMerlinPath(path: NuclideUri): Promise<?any> {
  const instance = await getInstance(path);
  return instance ? instance.pushDotMerlinPath(path) : null;
}

export async function pushNewBuffer(name: NuclideUri, content: string): Promise<?any> {
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
  return instance ? await instance.locate(path, line, col, kind) : null;
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
  return instance ? await instance.enclosingType(path, line, col) : null;
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

export async function errors(
  path: NuclideUri,
): Promise<?Array<MerlinError>> {
  const instance = await getInstance(path);
  return instance ? instance.errors() : null;
}

export async function outline(
  path: NuclideUri,
): Promise<?Array<MerlinOutline>> {
  const instance = await getInstance(path);
  return instance ? instance.outline(path) : null;
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
  return instance ? instance.runSingleCommand(command) : null;
}
