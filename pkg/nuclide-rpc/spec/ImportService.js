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

import type {ImportedType} from './Types';
import type {
  AliasImportedType,
  AliasImportedType2,
  AnotherImportedType,
} from './MoreTypes';

// We should be able to import types from non-rpc compatible files
// as long as they are not used in the external interface of the file.
// $FlowIgnore - Ignore the fact that the file doesn't exist.
import type {NonRpcType} from './NonRpcFile';

export let _NonRpcDefinition: NonRpcType;

export async function f(t: ImportedType): Promise<ImportedType> {
  return t;
}

export async function f2(t: AliasImportedType): Promise<ImportedType> {
  return t;
}

export async function f3(t: AliasImportedType2): Promise<ImportedType> {
  return t;
}

export async function g(t: AnotherImportedType): Promise<ImportedType> {
  return t.field;
}
