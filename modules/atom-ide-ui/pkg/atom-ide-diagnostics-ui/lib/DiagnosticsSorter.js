/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import type {Row} from 'nuclide-commons-ui/Table';
import type {DisplayDiagnostic} from './DiagnosticsTable';

/*
 * Sorts the diagnostics according to given column and sort direction
 */
export function sortDiagnostics(
  diagnostics: Array<Row>,
  sortedColumnName: ?string,
  sortDescending: boolean,
): Array<Row> {
  if (sortedColumnName == null) {
    return diagnostics;
  }
  const cmp: any = sortedColumnName === 'range' ? _cmpNumber : _cmpString;
  const getter = (displayDiagnostic: {+data: DisplayDiagnostic}) =>
    sortedColumnName === 'description'
      ? displayDiagnostic.data.description.text
      : displayDiagnostic.data[sortedColumnName];
  // $FlowFixMe -- this whole thing is poorly typed
  return [...diagnostics].sort((a, b) => {
    // $FlowFixMe -- this whole thing is poorly typed
    return cmp(getter(a), getter(b), !sortDescending);
  });
}

function _cmpNumber(a: number, b: number, isAsc: boolean): number {
  const cmp = a - b;
  return isAsc ? cmp : -cmp;
}

function _cmpString(a: string, b: string, isAsc: boolean): number {
  const cmp = a.toLowerCase().localeCompare(b.toLowerCase());
  return isAsc ? cmp : -cmp;
}
