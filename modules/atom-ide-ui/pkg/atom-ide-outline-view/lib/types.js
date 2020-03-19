/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import type {Observable} from 'rxjs';
import type {TokenizedText} from 'nuclide-commons/tokenized-text';
import type {Result} from 'nuclide-commons-atom/ActiveEditorRegistry';

export type OutlineProvider = {
  name: string,
  // If there are multiple providers for a given grammar, the one with the highest priority will be
  // used.
  priority: number,
  +grammarScopes?: Array<string>,
  getOutline(editor: TextEditor): Promise<?Outline>,
};

export type OutlineTree = {
  icon?: string, // from atom$Octicon (that type's not allowed over rpc so we use string)
  kind?: OutlineTreeKind, // kind you can pass to the UI for theming

  // Must be one or the other. If both are present, tokenizedText is preferred.
  plainText?: string,
  tokenizedText?: TokenizedText,

  // If user has atom-ide-outline-view.nameOnly then representativeName is used instead.
  representativeName?: string,

  startPosition: atom$Point,
  endPosition?: atom$Point,
  landingPosition?: atom$Point,
  children: Array<OutlineTree>,
};

export type Outline = {
  outlineTrees: Array<OutlineTree>,
};

// Kind of outline tree - matches the names from the Language Server Protocol v2.
export type OutlineTreeKind =
  | 'file'
  | 'module'
  | 'namespace'
  | 'package'
  | 'class'
  | 'method'
  | 'property'
  | 'field'
  | 'constructor'
  | 'enum'
  | 'interface'
  | 'function'
  | 'variable'
  | 'constant'
  | 'string'
  | 'number'
  | 'boolean'
  | 'array';

export type ResultsStreamProvider = {
  getResultsStream: () => Observable<Result<OutlineProvider, ?Outline>>,
};
