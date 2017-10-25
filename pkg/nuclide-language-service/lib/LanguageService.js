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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {DeadlineRequest} from 'nuclide-commons/promise';
import type {AdditionalLogFile} from '../../nuclide-logging/lib/rpc-types';
import type {FileVersion} from '../../nuclide-open-files-rpc/lib/rpc-types';
import type {TextEdit} from 'nuclide-commons-atom/text-edit';
import type {TypeHint} from '../../nuclide-type-hint/lib/rpc-types';
import type {CoverageResult} from '../../nuclide-type-coverage/lib/rpc-types';
import type {
  DiagnosticFix,
  DiagnosticMessage,
  DiagnosticMessageKind,
  DiagnosticMessageType,
  DefinitionQueryResult,
  DiagnosticTrace,
  FindReferencesReturn,
  Outline,
  CodeAction,
} from 'atom-ide-ui';
import type {ConnectableObservable} from 'rxjs';
import type {NuclideEvaluationExpression} from '../../nuclide-debugger-interfaces/rpc-types';
import type {SymbolResult} from '../../nuclide-quick-open/lib/types';

export type {SymbolResult} from '../../nuclide-quick-open/lib/types';

// Subtype of atom$AutocompleteSuggestion.
export type Completion = {
  // These fields are part of atom$AutocompleteSuggestion:
  text?: string,
  snippet?: string,
  displayText?: string,
  replacementPrefix?: string,
  type?: ?string,
  leftLabel?: ?string,
  leftLabelHTML?: ?string,
  rightLabel?: ?string,
  rightLabelHTML?: ?string,
  className?: ?string,
  iconHTML?: ?string,
  description?: ?string,
  descriptionMoreURL?: ?string,
  // These fields are extra:
  filterText?: string, // used by updateAutocompleteResults
  sortText?: string, // used by updateAutocompleteResults
  extraData?: mixed, // used by whichever packages want to use it
  // If textEdits are provided, snippet + text + replacementPrefix are **ignored** in favor of
  // simply applying the given edits.
  // The edits must not overlap and should contain the position of the completion request.
  // Note: this is implemented in AutocompletionProvider and is not part of Atom's API.
  textEdits?: Array<TextEdit>,
};

// This assertion ensures that Completion is a subtype of atom$AutocompleteSuggestion. If you are
// getting errors here, you have probably just updated one without updating the other.
((({}: any): Completion): atom$AutocompleteSuggestion);

export type AutocompleteResult = {
  isIncomplete: boolean,
  items: Array<Completion>,
};

export type FormatOptions = {
  // Size of a tab in spaces.
  tabSize: number,
  // Prefer spaces over tabs.
  insertSpaces: boolean,
};

export type AutocompleteRequest = {|
  // The request might have been triggered manually (by the user pressing
  // ctrl+space) or automatically (by the user typing into the buffer).
  activatedManually: boolean,
  // If it was an automatic trigger, this is the character to the left of the
  // caret (i.e. what the user most likely just typed). If manual, it is null.
  triggerCharacter: ?string,
  // Prefix is that part of whatever word the caret's on that's to the left of
  // the caret. This prefix is calculated heuristically by the caller via a
  // language-appropriate regex. The results of autocomplete have the option to
  // override this.
  prefix: string,
|};

// A (RPC-able) subset of DiagnosticMessage.
export type FileDiagnosticMessage = {|
  kind?: DiagnosticMessageKind,
  providerName: string,
  type: DiagnosticMessageType,
  filePath: NuclideUri,
  text?: string,
  html?: string,
  range?: atom$Range,
  trace?: Array<DiagnosticTrace>,
  fix?: DiagnosticFix,
  actions?: void, // Help Flow believe this is a subtype.
  stale?: boolean,
|};

// Ensure that this is actually a subset.
(((null: any): FileDiagnosticMessage): DiagnosticMessage);

export type FileDiagnosticMap = Map<NuclideUri, Array<FileDiagnosticMessage>>;

export interface LanguageService {
  getDiagnostics(fileVersion: FileVersion): Promise<?FileDiagnosticMap>,

  observeDiagnostics(): ConnectableObservable<FileDiagnosticMap>,

  getAutocompleteSuggestions(
    fileVersion: FileVersion,
    position: atom$Point,
    request: AutocompleteRequest,
  ): Promise<?AutocompleteResult>,

  getDefinition(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?DefinitionQueryResult>,

  findReferences(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?FindReferencesReturn>,

  getCoverage(filePath: NuclideUri): Promise<?CoverageResult>,

  getOutline(fileVersion: FileVersion): Promise<?Outline>,

  /**
  * Requests CodeActions from a language service. This function can be called either
  * whenever the cursor position changes (in which case the range should be from
  * the beginning of the current word to the cursor's position) or whenever a user interacts
  * with a Diagnostic (in which case the range should be the range of that diagnostic)
  *
  * If no CodeActions are available, an empty array should be returned.
  */
  getCodeActions(
    fileVersion: FileVersion,
    range: atom$Range,
    diagnostics: Array<FileDiagnosticMessage>,
  ): Promise<Array<CodeAction>>,

  typeHint(fileVersion: FileVersion, position: atom$Point): Promise<?TypeHint>,

  highlight(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?Array<atom$Range>>,

  formatSource(
    fileVersion: FileVersion,
    range: atom$Range,
    options: FormatOptions,
  ): Promise<?Array<TextEdit>>,

  formatEntireFile(
    fileVersion: FileVersion,
    range: atom$Range,
    options: FormatOptions,
  ): Promise<?{
    newCursor?: number,
    formatted: string,
  }>,

  formatAtPosition(
    fileVersion: FileVersion,
    position: atom$Point,
    triggerCharacter: string,
    options: FormatOptions,
  ): Promise<?Array<TextEdit>>,

  getAdditionalLogFiles(
    deadline: DeadlineRequest,
  ): Promise<Array<AdditionalLogFile>>,

  getEvaluationExpression(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?NuclideEvaluationExpression>,

  supportsSymbolSearch(directories: Array<NuclideUri>): Promise<boolean>,

  symbolSearch(
    query: string,
    directories: Array<NuclideUri>,
  ): Promise<?Array<SymbolResult>>,

  getProjectRoot(fileUri: NuclideUri): Promise<?NuclideUri>,

  isFileInProject(fileUri: NuclideUri): Promise<boolean>,

  getExpandedSelectionRange(
    fileVersion: FileVersion,
    currentSelection: atom$Range,
  ): Promise<?atom$Range>,

  getCollapsedSelectionRange(
    fileVersion: FileVersion,
    currentSelection: atom$Range,
    originalCursorPosition: atom$Point,
  ): Promise<?atom$Range>,

  dispose(): void,
}
