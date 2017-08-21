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

import type {FileDiagnosticMessage} from '../../../pkg/atom-ide-diagnostics/lib/types';

export interface CodeAction {
  apply(): Promise<void>,
  getTitle(): Promise<string>,
  dispose(): void,
}

export type CodeActionProvider = {
  grammarScopes: Array<string>,
  priority: number,
  getCodeActions(
    editor: atom$TextEditor,
    range: atom$Range,
    diagnostics: Array<FileDiagnosticMessage>,
  ): Promise<Array<CodeAction>>,
};

/**
* atom-ide-code-actions provides a CodeActionFetcher which offers an API to
* request CodeActions from all CodeAction providers. For now, CodeActionFetcher
* can only fetch CodeActions for a Diagnostic. In the future, this API can be
* extended to provide a stream of CodeActions based on the cursor position.
*/
export type CodeActionFetcher = {
  getCodeActionForDiagnostic: (
    diagnostic: FileDiagnosticMessage,
    editor: atom$TextEditor,
  ) => Promise<Array<CodeAction>>,
};
