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

import type {FlowLocNoSource} from './flowOutputTypes';

import {Range} from 'simple-text-buffer';
import {getConfig} from './config';

export function getStopFlowOnExit(): boolean {
  return Boolean(getConfig('stopFlowOnExit'));
}

export function flowCoordsToAtomCoords(
  flowCoords: FlowLocNoSource,
): atom$Range {
  return new Range(
    [flowCoords.start.line - 1, flowCoords.start.column - 1],
    [
      flowCoords.end.line - 1,
      // Yes, this is inconsistent. Yes, it works as expected in practice.
      flowCoords.end.column,
    ],
  );
}
