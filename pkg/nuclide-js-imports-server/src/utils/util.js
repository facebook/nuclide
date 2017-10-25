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

// flowlint-next-line untyped-type-import:off
import type {Position, IPosition, IRange} from 'vscode-languageserver-types';

import {Point, Range} from 'simple-text-buffer';

export function lspPositionToAtomPoint(lspPosition: IPosition): atom$Point {
  return new Point(lspPosition.line, lspPosition.character);
}

export function atomPointToLSPPosition(atomPoint: atom$PointObject): IPosition {
  return {
    line: atomPoint.row,
    character: atomPoint.column,
  };
}

export function babelLocationToAtomRange(location: Object): atom$Range {
  return new Range(
    new Point(location.start.line - 1, location.start.col),
    new Point(location.end.line - 1, location.end.col),
  );
}

export function atomRangeToLSPRange(atomRange: atom$Range): IRange {
  return {
    start: atomPointToLSPPosition(atomRange.start),
    end: atomPointToLSPPosition(atomRange.end),
  };
}

export function lspRangeToAtomRange(lspRange: IRange): atom$RangeObject {
  return {
    start: lspPositionToAtomPoint(lspRange.start),
    end: lspPositionToAtomPoint(lspRange.end),
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

/**
 * Sort in decreasing order of 'globality':
 * - Modules
 * - Relative paths in other directories (../*)
 * - Local paths (./*)
 */
const MODULES_PRIORITY = -1;
const RELATIVE_PRIORITY = 0;
const LOCAL_PRIORITY = 1;

export function importPathToPriority(path: string): number {
  if (path.startsWith('..')) {
    return RELATIVE_PRIORITY;
  }
  if (path.startsWith('.')) {
    return LOCAL_PRIORITY;
  }
  return MODULES_PRIORITY;
}

function isLowerCase(s: string) {
  return s.toLowerCase() === s;
}

export function compareForInsertion(path1: string, path2: string): number {
  const p1 = importPathToPriority(path1);
  const p2 = importPathToPriority(path2);
  if (p1 !== p2) {
    // Typically the highest-priority imports are at the end.
    return p1 - p2;
  }
  if (p1 === MODULES_PRIORITY) {
    // Order uppercase modules before lowercased modules.
    // (Mostly a Facebook-friendly convention).
    const lc1 = isLowerCase(path1[0]);
    const lc2 = isLowerCase(path2[0]);
    if (lc1 !== lc2) {
      return Number(lc1) - Number(lc2);
    }
  }
  return path1.localeCompare(path2);
}

export function compareForSuggestion(path1: string, path2: string): number {
  const p1 = importPathToPriority(path1);
  const p2 = importPathToPriority(path2);
  if (p1 !== p2) {
    // Provide highest-priority matches first.
    return p2 - p1;
  }
  // Prefer shorter paths.
  if (path1.length !== path2.length) {
    return path1.length - path2.length;
  }
  return path1.localeCompare(path2);
}

// Check if an AST node is a require call, and returns the literal value.
export function getRequiredModule(node: Object): ?string {
  if (
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === 'require' &&
    node.arguments[0] &&
    node.arguments[0].type === 'StringLiteral'
  ) {
    return node.arguments[0].value;
  }
}
