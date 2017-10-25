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

import typeof * as OpenFilesService from '../../nuclide-open-files-rpc/lib/OpenFilesService';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {FileNotifier} from '../../nuclide-open-files-rpc/lib/rpc-types';

import {
  getServiceByConnection,
  ServerConnection,
  ConnectionCache,
} from '../../nuclide-remote-connection';
import {OPEN_FILES_SERVICE} from '../../nuclide-open-files-rpc';
import os from 'os';
import {getLogger} from 'log4js';
import {FileEventKind} from '../../nuclide-open-files-rpc';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {Observable, Subscription} from 'rxjs';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {Disposable} from 'atom';
import {areSetsEqual} from 'nuclide-commons/collection';
import {track} from '../../nuclide-analytics';

const logger = getLogger('nuclide-open-files');

const RESYNC_TIMEOUT_MS = 2000;
const TEN_MINUTES = 10 * 60 * 1000;
const TWO_HOURS = 2 * 60 * 60 * 1000;

function getOpenFilesService(connection: ?ServerConnection): OpenFilesService {
  return getServiceByConnection(OPEN_FILES_SERVICE, connection);
}

function uriMatchesConnection(
  uri: NuclideUri,
  connection: ?ServerConnection,
): boolean {
  if (connection == null) {
    return nuclideUri.isLocal(uri);
  } else {
    return connection.getRemoteHostname() === nuclideUri.getHostnameOpt(uri);
  }
}

// Keeps a FileNotifier around per ServerConnection.
//
// Also handles sending 'close' events to the FileNotifier so that
// the per-Buffer BufferSubscription does not need to live past
// the buffer being destroyed.
export class NotifiersByConnection {
  _notifiers: ConnectionCache<FileNotifier>;
  _subscriptions: ConnectionCache<IDisposable>;
  _bufferTracking: Subscription;
  _getService: (connection: ?ServerConnection) => OpenFilesService;

  constructor(
    getService: (
      connection: ?ServerConnection,
    ) => OpenFilesService = getOpenFilesService,
  ) {
    this._getService = getService;
    const filterByConnection = (connection, dirs) =>
      new Set(dirs.filter(dir => uriMatchesConnection(dir, connection)));
    this._notifiers = new ConnectionCache(connection => {
      const result = this._getService(connection).initialize();
      result.then(notifier => {
        const dirs = filterByConnection(connection, atom.project.getPaths());
        notifier.onDirectoriesChanged(dirs);
      });
      return result;
    });
    this._subscriptions = new ConnectionCache(connection => {
      const subscription = observableFromSubscribeFunction(cb =>
        atom.project.onDidChangePaths(cb),
      )
        .map(dirs => filterByConnection(connection, dirs))
        .distinctUntilChanged(areSetsEqual)
        .subscribe(dirs => {
          this._notifiers.get(connection).then(notifier => {
            notifier.onDirectoriesChanged(dirs);
          });
        });
      return Promise.resolve(new Disposable(() => subscription.unsubscribe()));
    });
    const user = os.userInfo().username;
    this._bufferTracking = Observable.timer(TEN_MINUTES, TWO_HOURS)
      .switchMap(() => this._notifiers.observeEntries())
      .subscribe(([sc, notifier]) => {
        const host = sc == null ? 'local' : sc.getRemoteHostname();
        notifier
          .then(n => n.getTotalBufferSize())
          .then(bufferSize =>
            track('open-file-buffer-usage', {bufferSize, user, host}),
          );
      });
  }

  dispose() {
    this._notifiers.dispose();
    this._subscriptions.dispose();
    this._bufferTracking.unsubscribe();
  }

  // Returns null for a buffer to a file on a closed remote connection
  // or a new buffer which has not been saved.
  get(buffer: atom$TextBuffer): ?Promise<FileNotifier> {
    return this.getForUri(buffer.getPath());
  }

  getForConnection(connection: ?ServerConnection): Promise<FileNotifier> {
    return this._notifiers.get(connection);
  }

  // Returns null for a buffer to a file on a closed remote connection
  // or a new buffer which has not been saved.
  getForUri(path: ?NuclideUri): ?Promise<FileNotifier> {
    return this._notifiers.getForUri(path);
  }

  // Sends the close message to the appropriate FileNotifier.
  // Will keep trying to send until the send succeeds or
  // the corresponding ServerConnection is closed.
  sendClose(filePath: NuclideUri, version: number): void {
    if (filePath === '') {
      return;
    }

    // Keep trying until either the close completes, or
    // the remote connection goes away
    const sendMessage = async () => {
      const notifier = this.getForUri(filePath);
      if (notifier != null) {
        try {
          const n = await notifier;
          const message = {
            kind: FileEventKind.CLOSE,
            fileVersion: {
              notifier: n,
              filePath,
              version,
            },
          };

          await message.fileVersion.notifier.onFileEvent(message);
        } catch (e) {
          logger.error(
            `Error sending file close event: ${filePath} ${version}`,
            e,
          );
          setTimeout(sendMessage, RESYNC_TIMEOUT_MS);
        }
      }
    };

    sendMessage();
  }
}
