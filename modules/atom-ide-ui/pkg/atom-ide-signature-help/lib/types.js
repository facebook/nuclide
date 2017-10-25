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

export type SignatureHelpRegistry = (
  provider: SignatureHelpProvider,
) => IDisposable;

/**
 * Signature help is activated when:
 * - upon keystroke, any provider with a matching grammar scope contains
 *   the pressed key inside its triggerCharacters set
 * - the signature-help:show command is manually activated
 *
 * Once signature help has been triggered, the provider will be queried immediately
 * with the current cursor position, and then repeatedly upon cursor movements
 * until a null/empty signature is returned.
 *
 * Returned signatures will be displayed in a small datatip at the current cursor.
 * The highest-priority provider with a non-null result will be used.
 */
export type SignatureHelpProvider = {
  priority: number,
  grammarScopes: Array<string>,

  // A set of characters that will trigger signature help when typed.
  // If a null/empty set is provided, only manual activation of the command works.
  triggerCharacters?: Set<string>,

  getSignatureHelp(
    editor: atom$TextEditor,
    point: atom$Point,
  ): Promise<?SignatureHelp>,
};

export type SignatureHelp = {
  signatures: Array<Signature>,
  activeSignature?: number,
  activeParameter?: number,
};

export type Signature = {
  label: string,
  documentation?: string,
  parameters?: Array<SignatureParameter>,
};

export type SignatureParameter = {
  label: string,
  documentation?: string,
};
