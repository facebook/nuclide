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

import type {Provider} from './ProviderRegistry';
import type {TextEdit} from './text-edit';

import {Observable} from 'rxjs';
import {track} from 'nuclide-commons/analytics';
import ProviderRegistry from './ProviderRegistry';
import {applyTextEditsToBuffer} from './text-edit';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

export type FileEventHandlersConfig = {|
  supportsOnWillSave: boolean,
  onWillSaveTimeout?: number,
  onWillSavePriority?: number,
|};

type OnWillSaveProvider = Provider & {
  timeout: number,
  callback: (e: atom$TextEditor) => Observable<TextEdit>,
};

// Timeouts if providers don't all finish in 5 seconds.
const GLOBAL_SAVE_TIMEOUT_MS = 5000;
const onWillSaveProviders: ProviderRegistry<
  OnWillSaveProvider,
> = new ProviderRegistry();

// Returns an observable of booleans, each of which indicates whether the
// formatting text edits from a given provider was successfully applied or not.
function onWillSave(editor: atom$TextEditor): Observable<boolean> {
  if (editor.getPath() == null) {
    return Observable.empty();
  }

  const providers = Array.from(
    onWillSaveProviders.getAllProvidersForEditor(editor),
  );
  // NOTE: concat() is used here to subscribe to providers sequentially and
  // apply their text edits in order.
  return Observable.concat(
    ...providers.map((provider: OnWillSaveProvider) =>
      provider
        .callback(editor)
        .toArray()
        .race(Observable.of([]).delay(provider.timeout))
        .map(edits => {
          const success = applyTextEditsToBuffer(editor.getBuffer(), edits);
          return success;
        }),
    ),
  );
}

// HACK: intercept the real TextEditor.save and handle it ourselves.
// Atom has no way of injecting content into the buffer asynchronously
// before a save operation.
// If we try to format after the save, and then save again,
// it's a poor user experience (and also races the text buffer's reload).
function patchEditorSave(editor: atom$TextEditor): IDisposable {
  const realSave = editor.save;
  const editor_ = (editor: any);
  editor_.save = async () => {
    const timeout = new Date();
    timeout.setTime(timeout.getTime() + GLOBAL_SAVE_TIMEOUT_MS);
    try {
      await onWillSave(editor_)
        .timeout(timeout)
        .toPromise();
    } catch (e) {
      const providers = Array.from(
        onWillSaveProviders.getAllProvidersForEditor(editor_),
      );
      track('timeout-on-save', {
        uri: editor.getPath(),
        providers,
      });
    } finally {
      await realSave.call(editor);
    }
  };
  return new UniversalDisposable(() => {
    editor_.save = realSave;
  });
}

export function registerOnWillSave(provider: OnWillSaveProvider): IDisposable {
  return onWillSaveProviders.addProvider(provider);
}

export function observeTextEditors(): IDisposable {
  const disposables = new UniversalDisposable();
  disposables.add(
    atom.workspace.observeTextEditors(editor => {
      disposables.add(patchEditorSave(editor));
    }),
  );
  return disposables;
}
