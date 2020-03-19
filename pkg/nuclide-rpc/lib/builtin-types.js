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

import type {
  BuiltinLocation,
  StringType,
  NumberType,
  BooleanType,
  AnyType,
  MixedType,
  NamedType,
  VoidType,
} from './types';

export const builtinLocation: BuiltinLocation = {
  type: 'builtin',
};

export const voidType: VoidType = {
  kind: 'void',
};

export const anyType: AnyType = {
  kind: 'any',
};

export const mixedType: MixedType = {
  kind: 'mixed',
};

export const stringType: StringType = {
  kind: 'string',
};

export const booleanType: BooleanType = {
  kind: 'boolean',
};

export const numberType: NumberType = {
  kind: 'number',
};

export const objectType: NamedType = {
  kind: 'named',
  name: 'Object',
};

export const dateType: NamedType = {
  kind: 'named',
  name: 'Date',
};

export const regExpType: NamedType = {
  kind: 'named',
  name: 'RegExp',
};

export const bufferType: NamedType = {
  kind: 'named',
  name: 'Buffer',
};

export const fsStatsType: NamedType = {
  kind: 'named',
  name: 'fs.Stats',
};

export const namedBuiltinTypes: Array<string> = [
  objectType.name,
  dateType.name,
  regExpType.name,
  bufferType.name,
  fsStatsType.name,
];
