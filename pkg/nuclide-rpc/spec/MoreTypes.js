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

import type {ImportedType as AliasImportedType} from './Types';

// Use ImportedType from another file - testing, multiple
// imports the same file.
export type AnotherImportedType = {
  field: AliasImportedType,
};

export type {AliasImportedType};

export type {ImportedType as AliasImportedType2} from './Types';

// Non-RPC compatible types are fine, as long as they're not used.
export type NonRpcType = () => string;
export function f(x: string | number): void {}
export class C {}
export interface I {}
