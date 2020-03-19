/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict
 * @format
 */

// flowlint-next-line untyped-type-import:off
import type {Position, IPosition, IRange} from 'vscode-languageserver-types';

import {Point} from 'simple-text-buffer';

export function lspPositionToAtomPoint(lspPosition: IPosition): atom$Point {
  return new Point(lspPosition.line, lspPosition.character);
}

export function atomPointToLSPPosition(atomPoint: atom$PointObject): IPosition {
  return {
    line: atomPoint.row,
    character: atomPoint.column,
  };
}

export function lspRangeToAtomRange(lspRange: IRange): atom$RangeObject {
  return {
    start: lspPositionToAtomPoint(lspRange.start),
    end: lspPositionToAtomPoint(lspRange.end),
  };
}

export function atomRangeToLSPRange(atomRange: atom$Range): IRange {
  return {
    start: atomPointToLSPPosition(atomRange.start),
    end: atomPointToLSPPosition(atomRange.end),
  };
}

export function compareLspPosition(a: Position, b: Position): number {
  return a.line - b.line || a.character - b.character;
}

export function compareLspRange(a: IRange, b: IRange): number {
  return (
    compareLspPosition(a.start, b.start) || compareLspPosition(a.end, b.end)
  );
}
