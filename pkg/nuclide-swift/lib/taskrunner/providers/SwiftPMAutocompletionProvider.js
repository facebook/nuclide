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

import type {SourceKittenCompletion} from '../../sourcekitten/Complete';

import SwiftPMTaskRunnerStore from '../SwiftPMTaskRunnerStore';
import {asyncExecuteSourceKitten} from '../../sourcekitten/SourceKitten';
import sourceKittenCompletionToAtomSuggestion from '../../sourcekitten/Complete';

/**
 * An autocompletion provider that uses the compile commands in a built Swift
 * package's debug.yaml or release.yaml.
 */
export default class SwiftPMAutocompletionProvider {
  _store: SwiftPMTaskRunnerStore;

  constructor(store: SwiftPMTaskRunnerStore) {
    this._store = store;
  }

  async getAutocompleteSuggestions(request: {
    editor: atom$TextEditor,
    bufferPosition: atom$Point,
    scopeDescriptor: any,
    prefix: string,
  }): Promise<?Array<atom$AutocompleteSuggestion>> {
    const filePath = request.editor.getPath();
    let compilerArgs;
    // flowlint-next-line sketchy-null-string:off
    if (filePath) {
      const commands = await this._store.getCompileCommands();
      compilerArgs = commands.get(filePath);
    }

    const {bufferPosition, editor, prefix} = request;
    const offset =
      editor.getBuffer().characterIndexForPosition(bufferPosition) -
      prefix.length;
    const result = await asyncExecuteSourceKitten(
      'complete',
      [
        '--text',
        request.editor.getText(),
        '--offset',
        String(offset),
        '--',
      ].concat(compilerArgs ? compilerArgs : []),
    );

    // flowlint-next-line sketchy-null-string:off
    if (!result) {
      return [];
    }

    return JSON.parse(result)
      .filter((completion: SourceKittenCompletion) =>
        completion.name.startsWith(prefix),
      )
      .map(sourceKittenCompletionToAtomSuggestion);
  }
}
