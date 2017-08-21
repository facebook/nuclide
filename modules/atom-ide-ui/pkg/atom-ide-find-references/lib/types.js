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

export type FindReferencesProvider = {
  // Return true if your provider supports finding references for the provided TextEditor.
  isEditorSupported(editor: TextEditor): Promise<boolean>,

  // `findReferences` will only be called if `isEditorSupported` previously returned true
  // for the given TextEditor.
  findReferences(
    editor: TextEditor,
    position: atom$Point,
  ): Promise<?FindReferencesReturn>,
};

export type Reference = {
  uri: NuclideUri, // Nuclide URI of the file path
  name: ?string, // name of calling method/function/symbol
  range: atom$Range,
};

export type FindReferencesData = {
  type: 'data',
  baseUri: NuclideUri,
  referencedSymbolName: string,
  references: Array<Reference>,
};

export type FindReferencesError = {
  type: 'error',
  message: string,
};

export type FindReferencesReturn = FindReferencesData | FindReferencesError;

export type ReferenceGroup = {
  references: Array<Reference>,
  // Start and end range of the preview text.
  startLine: number,
  endLine: number,
};

export type FileReferences = {
  uri: string,
  grammar: Object /* atom$Grammar */,
  previewText: Array<string>,
  refGroups: Array<ReferenceGroup>,
};
