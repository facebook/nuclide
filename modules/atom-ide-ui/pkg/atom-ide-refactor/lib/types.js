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

/*
 * This file houses types that are internal to this package. Types that are part of its public
 * interface are exported from main.js
 */
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {Observable} from 'rxjs';
import type {TextEdit} from 'nuclide-commons-atom/text-edit';

export type Store = {
  // Returns unsubscribe function
  subscribe(fn: () => mixed): () => void,
  dispatch(action: RefactorAction): void,
  getState(): RefactorState,
};

export type RefactorUIFactory = (store: Store) => IDisposable;

export type RefactorUI = 'generic' | 'rename';

// Server Response & RPC Requests to Apply them

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

export type AvailableRefactoring = FreeformRefactoring;

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

// ExternalEdits & RenameExternalEdits are intended for changes that include unopened files.
//  These edits will be written directly to disk, bypassing Atom.

//  The format of RenameExternaledits is the same as that of regular "edits".
//  However, during their application, they will first be converted
//    into absolute character offsets.
export type RenameExternalEditResponse = {
  type: 'rename-external-edit',
  edits: Map<NuclideUri, Array<TextEdit>>,
};

// The format of ExternalEdits are those of ExternalTextEdit, and are
//  already formatted as absolute character offsets. These are responses
//  to the requests sent by the FreeformRefactorComponent.
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

export type RefactorEditResponse =
  | EditResponse
  | ExternalEditResponse
  | RenameExternalEditResponse;

export type RefactorResponse = RefactorEditResponse | ProgressResponse;

// State

export type ClosedState = {|
  type: 'closed',
|};

export type OpenState = {|
  type: 'open',
  ui: RefactorUI,
  phase: Phase,
|};

export type RefactorState = ClosedState | OpenState;

export type GetRefactoringsPhase = {|
  type: 'get-refactorings',
|};

export type PickPhase = {|
  type: 'pick',
  providers: RefactorProvider[],
  originalRange: atom$Range,
  editor: atom$TextEditor,
  availableRefactorings: Array<AvailableRefactoring>,
|};

export type FreeformPhase = {|
  type: 'freeform',
  providers: RefactorProvider[],
  editor: atom$TextEditor,
  originalRange: atom$Range,
  refactoring: FreeformRefactoring,
|};

export type ExecutePhase = {|
  type: 'execute',
|};

// For multi-file changes, add a confirmation step.
export type ConfirmPhase = {|
  type: 'confirm',
  response: RefactorEditResponse,
|};

export type DiffPreviewPhase = {|
  type: 'diff-preview',
  loading: boolean,
  diffs: Array<diffparser$FileDiff>,
  previousPhase: Phase,
|};

export type RenamePhase = {|
  type: 'rename',
  providers: RefactorProvider[],
  editor: TextEditor,
  selectedText: string,
  mountPosition: atom$Point,
  symbolPosition: atom$Point,
|};

export type ProgressPhase = {|
  type: 'progress',
  message: string,
  value: number,
  max: number,
|};

export type Phase =
  | GetRefactoringsPhase
  | PickPhase
  | FreeformPhase
  | ExecutePhase
  | ConfirmPhase
  | DiffPreviewPhase
  | RenamePhase
  | ProgressPhase;

export type RefactoringPhase = RenamePhase | FreeformPhase;

// Actions

export type OpenAction = {|
  type: 'open',
  ui: RefactorUI,
|};

export type BackFromDiffPreviewAction = {|
  type: 'back-from-diff-preview',
  payload: {
    phase: Phase,
  },
|};

export type GotRefactoringsAction = {|
  type: 'got-refactorings',
  payload: {
    originalRange: atom$Range,
    editor: atom$TextEditor,
    providers: RefactorProvider[],
    availableRefactorings: Array<AvailableRefactoring>,
  },
|};

export type ErrorSource = 'get-refactorings' | 'execute';

export type ErrorAction = {|
  type: 'error',
  payload: {
    source: ErrorSource,
    error: Error,
  },
|};

export type CloseAction = {|
  type: 'close',
|};

export type PickedRefactorAction = {|
  type: 'picked-refactor',
  payload: {
    refactoring: AvailableRefactoring,
  },
|};

export type ExecuteAction = {|
  type: 'execute',
  payload: {
    providers: RefactorProvider[],
    refactoring: RefactorRequest,
  },
|};

export type ConfirmAction = {|
  type: 'confirm',
  payload: {
    response: RefactorEditResponse,
  },
|};

export type LoadDiffPreviewAction = {|
  type: 'load-diff-preview',
  payload: {
    previousPhase: Phase,
    uri: NuclideUri,
    response: RefactorEditResponse,
  },
|};

export type DisplayDiffPreviewAction = {|
  type: 'display-diff-preview',
  payload: {
    diffs: Array<diffparser$FileDiff>,
  },
|};

export type DisplayRenameAction = {|
  type: 'display-rename',
  payload: {
    editor: TextEditor,
    providers: RefactorProvider[],
    selectedText: string,
    mountPosition: atom$Point,
    symbolPosition: atom$Point,
  },
|};

export type ApplyAction = {|
  type: 'apply',
  payload: {
    response: RefactorEditResponse,
  },
|};

export type ProgressAction = {|
  type: 'progress',
  payload: {
    message: string,
    value: number,
    max: number,
  },
|};

export type RefactorAction =
  | OpenAction
  | CloseAction
  | BackFromDiffPreviewAction
  | PickedRefactorAction
  | GotRefactoringsAction
  | ErrorAction
  | ExecuteAction
  | ConfirmAction
  | LoadDiffPreviewAction
  | DisplayDiffPreviewAction
  | DisplayRenameAction
  | ApplyAction
  | ProgressAction;

// Provider

export type RenameRefactorKind = 'rename';
export type FreeformRefactorKind = 'freeform';

export type RefactorKind = RenameRefactorKind | FreeformRefactorKind;

export type RenameRequest = {
  kind: RenameRefactorKind,
  newName: string,
  editor: TextEditor,
  position: atom$Point,
};

export type FreeformRefactorRequest = {|
  kind: FreeformRefactorKind,
  editor: atom$TextEditor,
  originalRange: atom$Range,
  // Echoes FreeformRefactoring.id.
  id: string,
  // Echoes FreeformRefactoring.range.
  range: atom$Range,
  // Arguments provided by the user.
  arguments: Map<string, mixed>,
|};

export type RefactorRequest = RenameRequest | FreeformRefactorRequest;

export type RenameData = {
  type: 'data',
  data: Map<NuclideUri, Array<TextEdit>>,
};

export type RenameError = {
  type: 'error',
  message: string,
};

export type RenameReturn = RenameData | RenameError;

export type RefactorProvider = {
  priority: number,
  +grammarScopes?: Array<string>,

  refactorings?: (
    editor: atom$TextEditor,
    range: atom$Range,
  ) => Promise<Array<AvailableRefactoring>>,

  // Providers may stream back progress responses.
  // Note that the stream will terminate once an edit response is received.
  // If no edit response is received, an error will be raised.
  refactor?: (request: RefactorRequest) => Observable<RefactorResponse>,

  // This method is linked to LSP in the LSP version of RefactorProvider
  // Obtains a mapping of document paths to their text edits.
  //  Each text edit is a rename of the same subject
  rename?: (
    editor: TextEditor,
    position: atom$Point,
    newName: string,
  ) => Promise<?RenameReturn>,
};
