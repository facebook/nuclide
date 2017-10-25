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

import typeof * as RemoteCommandServiceType from '../../nuclide-remote-atom-rpc/lib/RemoteCommandService';
import type {
  AtomCommands,
  AtomFileEvent,
} from '../../nuclide-remote-atom-rpc/lib/rpc-types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {ConnectableObservable} from 'rxjs';

import {
  getServiceByConnection,
  ConnectionCache,
} from '../../nuclide-remote-connection';
import {goToLocation} from 'nuclide-commons-atom/go-to-location';
import createPackage from 'nuclide-commons-atom/createPackage';
import featureConfig from 'nuclide-commons-atom/feature-config';
import {observeEditorDestroy} from 'nuclide-commons-atom/text-editor';
import {Observable} from 'rxjs';
import {
  RemoteConnection,
  ServerConnection,
} from '../../nuclide-remote-connection';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {getNotifierByConnection} from '../../nuclide-open-files';

const REMOTE_COMMAND_SERVICE = 'RemoteCommandService';

class Activation {
  _disposables: IDisposable;
  _commands: AtomCommands;

  constructor() {
    this._commands = {
      openFile(
        uri: NuclideUri,
        line: number,
        column: number,
        isWaiting: boolean,
      ): ConnectableObservable<AtomFileEvent> {
        return openFile(uri, line, column, isWaiting);
      },
      openRemoteFile(
        uri: NuclideUri,
        line: number,
        column: number,
        isWaiting: boolean,
      ): ConnectableObservable<AtomFileEvent> {
        if (ServerConnection.getForUri(uri) == null) {
          return Observable.throw(
            new Error(`Atom is not connected to host for ${uri}`),
          ).publish();
        }
        return openFile(uri, line, column, isWaiting);
      },
      async addProject(projectPath: NuclideUri): Promise<void> {
        if (nuclideUri.isLocal(projectPath)) {
          atom.project.addPath(projectPath);
        } else {
          // As of Atom 1.12 atom.project.addPath won't work for remote dirs.
          const serverConnection = ServerConnection.getForUri(projectPath);
          if (serverConnection != null) {
            // Creating the RemoteConnection should add it to the FileTree
            await RemoteConnection.findOrCreateFromConnection(
              serverConnection,
              nuclideUri.getPath(projectPath),
              '',
            );
          }
        }
      },
      dispose(): void {},
    };

    this._disposables = new ConnectionCache(async connection => {
      // If connection is null, this indicates a local connection. Because usage
      // of the local command server is low and it introduces the cost of
      // starting an extra process when Atom starts up, only enable it if the
      // user has explicitly opted-in.
      if (
        connection == null &&
        !featureConfig.get('nuclide-remote-atom.enableLocalCommandService')
      ) {
        return {dispose: () => {}};
      }

      const service: RemoteCommandServiceType = getServiceByConnection(
        REMOTE_COMMAND_SERVICE,
        connection,
      );
      const fileNotifier = await getNotifierByConnection(connection);
      return service.RemoteCommandService.registerAtomCommands(
        fileNotifier,
        this._commands,
      );
    });
  }

  dispose(): void {
    this._disposables.dispose();
  }
}

function openFile(
  uri: NuclideUri,
  line: number,
  column: number,
  isWaiting: boolean,
): ConnectableObservable<AtomFileEvent> {
  return Observable.fromPromise(
    goToLocation(uri, {line, column}).then(editor => {
      atom.applicationDelegate.focusWindow();

      if (
        isWaiting &&
        featureConfig.get(
          'nuclide-remote-atom.shouldNotifyWhenCommandLineIsWaitingOnFile',
        )
      ) {
        const notification = atom.notifications.addInfo(
          `The command line has opened \`${nuclideUri.getPath(uri)}\`` +
            ' and is waiting for it to be closed.',
          {
            dismissable: true,
            buttons: [
              {
                onDidClick: () => {
                  featureConfig.set(
                    'nuclide-remote-atom.shouldNotifyWhenCommandLineIsWaitingOnFile',
                    false,
                  );
                  notification.dismiss();
                },
                text: "Don't show again",
              },
              {
                onDidClick: () => {
                  editor.destroy();
                },
                text: 'Close file',
              },
            ],
          },
        );
        editor.onDidDestroy(() => {
          notification.dismiss();
        });
      }

      return editor;
    }),
  )
    .switchMap(editor =>
      Observable.merge(
        Observable.of('open'),
        observeEditorDestroy(editor).map(value => 'close'),
      ),
    )
    .publish();
}

createPackage(module.exports, Activation);
