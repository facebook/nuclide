/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {PredefinedTransformer} from '../../nuclide-rpc/lib/types';

import {
  getRemoteNuclideUriMarshalers,
  localNuclideUriMarshalers,
} from '../../nuclide-marshalers-common';

const isAtomProcess = typeof atom !== 'undefined';
let clientMarshallers = [];

// TODO support other client's point & range marshalling.
if (isAtomProcess) {
  const AtomPoint = require('atom').Point;
  const AtomRange = require('atom').Range;

  const jsonToAtomPoint = json => new AtomPoint(json.row, json.column);
  const jsonToAtomRange = json =>
    new AtomRange(jsonToAtomPoint(json.start), jsonToAtomPoint(json.end));

  clientMarshallers = [
    {
      typeName: 'atom$Point',
      marshaller: point => point,
      unmarshaller: jsonToAtomPoint,
    },
    {
      typeName: 'atom$Range',
      marshaller: range => range,
      unmarshaller: jsonToAtomRange,
    },
  ];
}

export function getClientSideMarshalers(
  hostname: string,
): Array<PredefinedTransformer> {
  const remoteUriMarshaller = getRemoteNuclideUriMarshalers(hostname);
  return [remoteUriMarshaller, ...clientMarshallers];
}

export const getClientSideLoopbackMarshalers: Array<PredefinedTransformer> = [
  localNuclideUriMarshalers,
  ...clientMarshallers,
];
