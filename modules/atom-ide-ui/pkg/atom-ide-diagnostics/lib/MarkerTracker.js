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

import type {FileDiagnosticMessage} from './rpc-types';

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import {CompositeDisposable} from 'atom';

import invariant from 'assert';

import {observeTextEditors} from 'nuclide-commons-atom/text-editor';
import {MultiMap} from 'nuclide-commons/collection';

export class MarkerTracker {
  /**
   * Stores all current FileDiagnosticMessages, indexed by file. Includes those for files that are
   * not open.
   */
  _fileToMessages: MultiMap<NuclideUri, FileDiagnosticMessage>;

  /**
   * Stores all current markers, indexed by FileDiagnosticMessage.
   * invariant: No messages for closed files, no destroyed markers.
   */
  _messageToMarker: Map<FileDiagnosticMessage, atom$Marker>;

  _subscriptions: CompositeDisposable;

  _disposed: boolean;

  constructor() {
    this._messageToMarker = new Map();
    this._fileToMessages = new MultiMap();
    this._subscriptions = new CompositeDisposable();
    this._disposed = false;

    this._subscriptions.add(
      observeTextEditors(editor => {
        const path = editor.getPath();
        if (path == null) {
          return;
        }
        const messagesForPath = this._fileToMessages.get(path);
        for (const message of messagesForPath) {
          // There might already be a marker because there can be multiple TextEditors open for a
          // given file.
          if (!this._messageToMarker.has(message)) {
            this._addMarker(editor, message);
          }
        }
      }),
    );
  }

  dispose() {
    if (!this._disposed) {
      this._subscriptions.dispose();
      for (const marker of this._messageToMarker.values()) {
        marker.destroy();
      }
      this._fileToMessages.clear();
      this._messageToMarker.clear();
      this._disposed = true;
    }
  }

  /** Return a Range if the marker is still valid, otherwise return null */
  getCurrentRange(message: FileDiagnosticMessage): ?atom$Range {
    this._assertNotDisposed();
    const marker = this._messageToMarker.get(message);

    if (marker != null && marker.isValid()) {
      return marker.getBufferRange();
    } else {
      return null;
    }
  }

  addFileMessages(messages: Array<FileDiagnosticMessage>): void {
    this._assertNotDisposed();
    // Right now we only care about messages with fixes.
    const messagesWithFix = messages.filter(m => m.fix != null);

    for (const message of messagesWithFix) {
      this._fileToMessages.add(message.filePath, message);

      // If the file is currently open, create a marker.

      // TODO If there is a long delay between when the file is saved and results appear, the file
      // may have changed in the mean time. Meaning that the markers we place here may be in the
      // wrong place already. Consider detecting such cases (perhaps with a checksum included in the
      // fix) and rejecting the fixes, since we can't accurately track their locations.

      const editorForFile = atom.workspace
        .getTextEditors()
        .filter(editor => editor.getPath() === message.filePath)[0];
      if (editorForFile != null) {
        this._addMarker(editorForFile, message);
      }
    }
  }

  /** Remove the given messages, if they are currently present */
  removeFileMessages(messages: Iterable<FileDiagnosticMessage>): void {
    this._assertNotDisposed();

    for (const message of messages) {
      this._fileToMessages.delete(message.filePath, message);

      const marker = this._messageToMarker.get(message);
      if (marker != null) {
        // No need to remove from the set explicitly since we do that on the marker's onDidDestroy
        // handler.
        marker.destroy();
      }
    }
  }

  _addMarker(editor: atom$TextEditor, message: FileDiagnosticMessage): void {
    const fix = message.fix;
    invariant(fix != null);

    const marker = editor.markBufferRange(fix.oldRange, {
      // 'touch' is the least permissive invalidation strategy: It will invalidate for
      // changes that touch the marked region in any way. We want to invalidate
      // aggressively because an incorrect fix application is far worse than a failed
      // application.
      invalidate: 'touch',
    });
    this._messageToMarker.set(message, marker);

    // The marker will be destroyed automatically when its associated TextBuffer is destroyed. Clean
    // up when that happens.
    const markerSubscription = marker.onDidDestroy(() => {
      this._messageToMarker.delete(message);
      markerSubscription.dispose();
      this._subscriptions.remove(markerSubscription);
    });
    this._subscriptions.add(markerSubscription);
  }

  _assertNotDisposed(): void {
    invariant(!this._disposed, 'MarkerTracker has been disposed');
  }
}
