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

import type {
  DiagnosticUpdater,
  DiagnosticMessage,
} from '../../atom-ide-diagnostics/lib/types';

import invariant from 'assert';
import electron from 'electron';
import {Observable} from 'rxjs';
import {arrayCompact, arrayFlatten} from 'nuclide-commons/collection';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

const {remote} = electron;
invariant(remote != null);

const CODE_ACTIONS_TIMEOUT = 2000;

export default function showActionsMenu(
  editor: TextEditor,
  position: atom$Point,
  messagesAtPosition: Array<DiagnosticMessage>,
  diagnosticUpdater: DiagnosticUpdater,
): IDisposable {
  diagnosticUpdater.fetchCodeActions(editor, messagesAtPosition);

  return new UniversalDisposable(
    observableFromSubscribeFunction(cb =>
      diagnosticUpdater.observeCodeActionsForMessage(cb),
    )
      .filter(codeActionsForMessage => {
        return messagesAtPosition.every(message =>
          codeActionsForMessage.has(message),
        );
      })
      .take(1)
      .race(Observable.of(new WeakMap()).delay(CODE_ACTIONS_TIMEOUT))
      .subscribe(codeActionsForMessage => {
        const currentWindow = remote.getCurrentWindow();
        const menu = new remote.Menu();
        const fixes = arrayCompact(
          messagesAtPosition.map(message => {
            const {fix} = message;
            if (fix == null) {
              return null;
            }
            const fixTitle = fix.title == null ? 'Fix' : fix.title;
            return {
              title: `${fixTitle} (${message.providerName})`,
              apply: () => diagnosticUpdater.applyFix(message),
            };
          }),
        );
        const actions = arrayFlatten(
          messagesAtPosition.map(message => {
            const codeActions = codeActionsForMessage.get(message);
            if (codeActions == null) {
              return [];
            }
            return Array.from(codeActions).map(([title, codeAction]) => ({
              title,
              apply: () => codeAction.apply(),
            }));
          }),
        );

        [...fixes, ...actions].forEach(action => {
          menu.append(
            new remote.MenuItem({
              type: 'normal',
              label: action.title,
              click: () => {
                action.apply();
              },
            }),
          );
        });

        const screenPosition = editor.screenPositionForBufferPosition(position);
        const editorView = atom.views.getView(editor);
        const pixelPosition = editorView.pixelPositionForScreenPosition(
          screenPosition,
        );
        // Pixel coordinates are relative to the editor's scroll view.
        const scrollView = editorView.querySelector('.scroll-view');
        invariant(scrollView != null);
        const boundingRect = scrollView.getBoundingClientRect();
        menu.popup(
          currentWindow,
          boundingRect.left + pixelPosition.left - editorView.getScrollLeft(),
          boundingRect.top + pixelPosition.top - editorView.getScrollTop(),
          0,
        );
      }),
  );
}
