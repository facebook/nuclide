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

import type {CodeAction, DiagnosticMessage} from 'atom-ide-ui';

import {DEFAULT_FLAGS_WARNING} from './constants';
import {resetForSource} from './libclang';

export default class CodeActions {
  static getCodeActions(
    editor: atom$TextEditor,
    range: atom$Range,
    diagnostics: Array<DiagnosticMessage>,
  ): Promise<Array<CodeAction>> {
    for (const diagnostic of diagnostics) {
      if (diagnostic.text === DEFAULT_FLAGS_WARNING) {
        return Promise.resolve([
          {
            dispose() {},
            getTitle: () => Promise.resolve('Clean, rebuild, and save file'),
            async apply() {
              await resetForSource(editor);
              await editor.save();
            },
          },
        ]);
      }
    }
    return Promise.resolve([]);
  }
}
