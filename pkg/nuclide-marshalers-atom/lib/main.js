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

import type {PredefinedTransformer} from '../../nuclide-rpc';

import {
  getRemoteNuclideUriMarshalers,
  localNuclideUriMarshalers,
} from '../../nuclide-marshalers-common';
import {Range as AtomRange, Point as AtomPoint} from 'atom';

const jsonToAtomPoint = json => new AtomPoint(json.row, json.column);
const jsonToAtomRange = json =>
  new AtomRange(jsonToAtomPoint(json.start), jsonToAtomPoint(json.end));

const atomPointMarshalers = {
  typeName: 'atom$Point',
  marshaller: point => point,
  unmarshaller: jsonToAtomPoint,
};

const atomRangeMarshalers = {
  typeName: 'atom$Range',
  marshaller: range => range,
  unmarshaller: jsonToAtomRange,
};

export function getAtomSideMarshalers(
  hostname: string,
): Array<PredefinedTransformer> {
  return [
    getRemoteNuclideUriMarshalers(hostname),
    atomPointMarshalers,
    atomRangeMarshalers,
  ];
}

export const getAtomSideLoopbackMarshalers: Array<PredefinedTransformer> = [
  localNuclideUriMarshalers,
  atomPointMarshalers,
  atomRangeMarshalers,
];
