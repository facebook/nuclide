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

import type {
  FileNotifier,
  LocalFileEvent,
  FileSyncEvent,
  FileEvent,
} from '../../nuclide-open-files-rpc/lib/rpc-types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {NotifiersByConnection} from './NotifiersByConnection';

import invariant from 'assert';
import {CompositeDisposable} from 'atom';
import {getLogger} from 'log4js';
import {FileEventKind} from '../../nuclide-open-files-rpc';

const logger = getLogger('nuclide-open-files');

const RESYNC_TIMEOUT_MS = 2000;

// Watches a TextBuffer for change/rename/destroy events and then sends
// those events to the FileNotifier or NotifiersByConnection as appropriate.
//
// change/rename events go to the FileNotifier.
// If sending a change/rename throws, that is an indication that we are out of
// sync with the server side, so send a 'sync' message.
//
// close events have a different error recovery policy so they go to the main
// NotifiersByConnection. The close message must be sent even if the buffer is
// renamed or destroyed, so rather than keep the per-buffer info around after
// a buffer is destroyed, the outstanding close messages are kept with the
// per-connection info in NotifiersByConnection.
export class BufferSubscription {
  _oldPath: ?NuclideUri;
  _notifiers: NotifiersByConnection;
  _buffer: atom$TextBuffer;
  _notifier: ?Promise<FileNotifier>;
  _subscriptions: CompositeDisposable;
  _serverVersion: number;
  _lastAttemptedSync: number;
  _changeCount: number;
  _sentOpen: boolean;

  constructor(notifiers: NotifiersByConnection, buffer: atom$TextBuffer) {
    this._notifiers = notifiers;
    this._buffer = buffer;
    this._notifier = null;
    this._serverVersion = -1;
    this._lastAttemptedSync = -1;
    this._changeCount = 1;
    this._sentOpen = false;

    const subscriptions = new CompositeDisposable();

    subscriptions.add(
      buffer.onDidChange(async (event: atom$TextEditEvent) => {
        this._changeCount++;
        if (this._notifier == null) {
          return;
        }

        // Must inspect the buffer before awaiting on the notifier
        // to avoid race conditions
        const filePath = this._buffer.getPath();
        invariant(filePath != null);
        const version = this._changeCount;

        invariant(this._notifier != null);
        const notifier = await this._notifier;
        if (this._sentOpen) {
          this.sendEvent({
            kind: FileEventKind.EDIT,
            fileVersion: {
              notifier,
              filePath,
              version,
            },
            oldRange: event.oldRange,
            newRange: event.newRange,
            oldText: event.oldText,
            newText: event.newText,
          });
        } else {
          this._sendOpenByNotifier(notifier, version);
        }
      }),
    );

    this._subscriptions = subscriptions;

    this._oldPath = this._buffer.getPath();
    this._notifier = this._notifiers.get(this._buffer);

    // This prevents the open message from sending when the file is initially empty.
    // Sadly there's no reliable 'is loaded' event from Atom.
    // TODO: Could watch onDidReload() which will catch the case where an empty file is opened
    // after startup, leaving the only failure the reopening of empty files at startup.
    if (this._buffer.getText() !== '' && this._notifier != null) {
      this._notifier.then(notifier =>
        this._sendOpenByNotifier(notifier, this._changeCount),
      );
    }
  }

  _sendOpenByNotifier(notifier: FileNotifier, version: number): void {
    const filePath = this._buffer.getPath();
    invariant(filePath != null);

    this._sentOpen = true;
    this.sendEvent({
      kind: FileEventKind.OPEN,
      fileVersion: {
        notifier,
        filePath,
        version,
      },
      contents: this._buffer.getText(),
    });
  }

  getVersion(): number {
    return this._changeCount;
  }

  async sendEvent(event: LocalFileEvent) {
    invariant(event.kind !== FileEventKind.SYNC);
    try {
      await event.fileVersion.notifier.onFileEvent(event);
      this.updateServerVersion(event.fileVersion.version);
    } catch (e) {
      logger.error(`Error sending file event: ${eventToString(event)}`, e);

      if (event.fileVersion.filePath === this._buffer.getPath()) {
        logger.error('Attempting file resync');
        this.attemptResync();
      } else {
        logger.error('File renamed, so no resync attempted');
      }
    }
  }

  updateServerVersion(sentVersion: number): void {
    this._serverVersion = Math.max(this._serverVersion, sentVersion);
    this._lastAttemptedSync = Math.max(this._lastAttemptedSync, sentVersion);
  }

  // Something went awry in our synchronization protocol
  // Attempt a reset with a 'sync' event.
  attemptResync() {
    // always attempt to resync to the latest version
    const resyncVersion = this._changeCount;
    const filePath = this._buffer.getPath();

    // don't send a resync if another edit has already succeeded at this version
    // or an attempt to sync at this version is already underway
    if (resyncVersion > this._lastAttemptedSync) {
      logger.error('At most recent edit, attempting file resync');
      this._lastAttemptedSync = resyncVersion;

      const sendResync = async () => {
        if (this._notifier == null) {
          logger.error('Resync preempted by remote connection closed');
          return;
        }
        invariant(filePath != null);
        const notifier = await this._notifier;
        if (this._buffer.isDestroyed()) {
          logger.error('Resync preempted by later event');
        } else if (filePath !== this._buffer.getPath()) {
          logger.error('Resync preempted by file rename');
        } else if (resyncVersion !== this._lastAttemptedSync) {
          logger.error('Resync preempted by later resync');
        } else if (resyncVersion !== this._changeCount) {
          logger.error('Resync preempted by later edit');
        } else {
          const syncEvent: FileSyncEvent = {
            kind: FileEventKind.SYNC,
            fileVersion: {
              notifier,
              filePath,
              version: resyncVersion,
            },
            contents: this._buffer.getText(),
          };
          try {
            await notifier.onFileEvent(syncEvent);
            this.updateServerVersion(resyncVersion);

            logger.error(
              `Successful resync event: ${eventToString(syncEvent)}`,
            );
          } catch (syncError) {
            logger.error(
              `Error sending file sync event: ${eventToString(syncEvent)}`,
              syncError,
            );

            // continue trying until either the file is closed,
            // or a resync to a later edit is attempted
            // or the resync succeeds
            setTimeout(sendResync, RESYNC_TIMEOUT_MS);
          }
        }
      };

      sendResync();
    } else {
      logger.error('Resync aborted by more recent edit');
    }
  }

  sendClose() {
    // Use different retry policy for close messages.
    if (this._oldPath != null) {
      this._notifiers.sendClose(this._oldPath, this._changeCount);
    }
  }

  dispose() {
    this.sendClose();
    this._notifier = null;
    this._subscriptions.dispose();
  }
}

function eventToString(event: FileEvent): string {
  const jsonable = {...event};
  jsonable.fileVersion = {...event.fileVersion};
  jsonable.fileVersion.notifier = null;
  return JSON.stringify(jsonable);
}
