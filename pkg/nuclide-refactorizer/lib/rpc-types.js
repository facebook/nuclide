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

import type {TextEdit} from 'nuclide-commons-atom/text-edit';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

export type RenameRefactoring = {
  kind: 'rename',
  symbolAtPoint: {
    text: string,
    range: atom$Range,
  },
};

export type FreeformEnumValue = {
  value: string,
  description: string,
};

// Factoring out `description` confuses Flow when filtering on the type.
export type FreeformRefactoringArgument =
  | {
      type: 'string',
      name: string,
      description: string,
      default?: string,
    }
  | {
      type: 'boolean',
      name: string,
      description: string,
      default?: boolean,
    }
  | {
      type: 'enum',
      name: string,
      description: string,
      options: Array<FreeformEnumValue>,
      default?: string,
    };

// A freeform refactoring type.
// This allows providers to define completely new refactoring commands,
// as well as ask for arbitrary arguments to the refactoring command.
export type FreeformRefactoring = {
  kind: 'freeform',
  // Unique identifier which will be used in the request.
  id: string,
  // Display name of the refactoring.
  name: string,
  // User-friendly description of what the refactoring does.
  description: string,
  // Full affected range of the refactoring.
  range: atom$Range,
  // Additional arguments to be requested from the user.
  // The `name`s should be unique identifiers, which will be used in the request.
  arguments: Array<FreeformRefactoringArgument>,
  // Providers can return disabled refactorings to improve discoverability.
  disabled?: boolean,
};

export type AvailableRefactoring = RenameRefactoring | FreeformRefactoring;

// For edits outside of Atom editors, it's easier and more efficient to use
// absolute character offsets rather than line/column ranges.
export type ExternalTextEdit = {
  startOffset: number,
  endOffset: number,
  newText: string,
  // If included, this will be used to verify that the edit still applies cleanly.
  oldText?: string,
};

// Regular "edits" are intended for changes inside open files.
// These will be applied to the buffer and will not be immediately saved.
// This is appropriate for small-scale changes to a set of files.
export type EditResponse = {
  type: 'edit',
  edits: Map<NuclideUri, Array<TextEdit>>,
};

// "externalEdits" are intended for changes that include unopened files.
// External edits will be directly written to files on disk, bypassing Atom.
// They also have a slightly different format for efficiency purposes.
export type ExternalEditResponse = {
  type: 'external-edit',
  edits: Map<NuclideUri, Array<ExternalTextEdit>>,
};

// An intermediate response to display progress in the UI.
export type ProgressResponse = {
  type: 'progress',
  message: string,
  value: number,
  max: number,
};

export type RefactorEditResponse = EditResponse | ExternalEditResponse;

export type RefactorResponse = RefactorEditResponse | ProgressResponse;
