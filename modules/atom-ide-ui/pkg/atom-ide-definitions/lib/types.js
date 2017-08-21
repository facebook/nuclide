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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

export type Definition = {
  // Path of the file in which the definition is located.
  path: NuclideUri,
  // First character of the definition's identifier.
  // e.g. "F" in `class Foo {}`
  position: atom$Point,
  // Optional: the range of the entire definition.
  // e.g. "c" to "}" in `class Foo {}`
  range?: atom$Range,
  // Optional: `name` and `projectRoot` can be provided to display a more human-readable title
  // inside of Hyperclick when there are multiple definitions.
  name?: string,
  // If provided, `projectRoot` will be used to display a relativized version of `path`.
  projectRoot?: NuclideUri,
  // `language` may be used by consumers to identify the source of definitions.
  language: string,
};

// Definition queries supply a point.
// The returned queryRange is the range within which the returned definition is valid.
// Typically queryRange spans the containing identifier around the query point.
export type DefinitionQueryResult = {
  queryRange: Array<atom$Range>,
  definitions: Array<Definition>,
};

// Provides definitions for a set of language grammars.
export type DefinitionProvider = {
  // If there are multiple providers for a given grammar,
  // the one with the highest priority will be used.
  priority: number,
  grammarScopes: Array<string>,
  getDefinition: (
    editor: TextEditor,
    position: atom$Point,
  ) => Promise<?DefinitionQueryResult>,
};

export type DefinitionPreviewProvider = {
  getDefinitionPreview(definition: Definition): Promise<string>,
};
