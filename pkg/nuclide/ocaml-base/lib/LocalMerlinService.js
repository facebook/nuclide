'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {NuclideUri} from '../../remote-uri';

import {getInstance} from './MerlinProcess';

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
  kind: string
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

export async function complete(
  path: NuclideUri,
  line: number,
  col: number,
  prefix: string
): Promise<any> {
  const instance = await getInstance(path);
  return instance ? instance.complete(path, line, col, prefix) : null;
}

/**
 * Low-level API into merlin service useful for debugging and for prototyping
 * on top of bleeding edge Merlin branches.
 */
export async function runSingleCommand(
  path: NuclideUri,
  command: mixed
): Promise<any> {
  const instance = await getInstance(path);
  return instance ? instance.runSingleCommand(command) : null;
}
