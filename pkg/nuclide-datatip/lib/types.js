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

import type Immutable from 'immutable';

// Borrowed from the LSP API.
export type MarkedString =
  | {
      type: 'markdown',
      value: string,
    }
  | {
      type: 'snippet',
      grammar: atom$Grammar,
      value: string,
    };

export type Datatip =
  | {|
      component: ReactClass<any>,
      range: atom$Range,
      pinnable?: boolean,
    |}
  | {|
      markedStrings: Array<MarkedString>,
      range: atom$Range,
      pinnable?: boolean,
    |};

export const ModifierKeys = Object.freeze({
  META: 'metaKey',
  SHIFT: 'shiftKey',
  ALT: 'altKey',
  CTRL: 'ctrlKey',
});

export type ModifierKey = 'metaKey' | 'shiftKey' | 'altKey' | 'ctrlKey';

export type PinnedDatatip = {
  dispose(): void,
};

export type DatatipProvider = {
  inclusionPriority: number,
  validForScope(scopeName: string): boolean,
  // A unique name for the provider to be used for analytics.
  // It is recommended that it be the name of the provider's package.
  providerName: string,
  datatip(
    editor: atom$TextEditor,
    bufferPosition: atom$Point,
  ): Promise<?Datatip>,
};

export type ModifierDatatipProvider = {
  inclusionPriority: number,
  validForScope(scopeName: string): boolean,
  providerName: string,
  modifierDatatip(
    editor: atom$TextEditor,
    bufferPosition: atom$Point,
    heldKeys: Immutable.Set<ModifierKey>,
  ): Promise<?Datatip>,
};

export type AnyDatatipProvider = DatatipProvider | ModifierDatatipProvider;

export type DatatipService = {
  addProvider(provider: DatatipProvider): IDisposable,
  addModifierProvider(provider: ModifierDatatipProvider): IDisposable,
  createPinnedDataTip(datatip: Datatip, editor: TextEditor): PinnedDatatip,
};
