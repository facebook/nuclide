'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import typeof * as RemoteCommandServiceType
  from '../../nuclide-remote-atom-rpc/lib/RemoteCommandService';
import type {AtomCommands, AtomFileEvent} from '../../nuclide-remote-atom-rpc/lib/rpc-types';
import type {NuclideUri} from '../../commons-node/nuclideUri';
import type {ConnectableObservable} from 'rxjs';

import {
  getServiceByConnection,
  ConnectionCache,
} from '../../nuclide-remote-connection';
import {goToLocation} from '../../commons-atom/go-to-location';
import createPackage from '../../commons-atom/createPackage';
import * as featureConfig from '../../commons-atom/featureConfig';
import {observeEditorDestroy} from '../../commons-atom/text-editor';
import {Observable} from 'rxjs';
import {ServerConnection} from '../../nuclide-remote-connection';
import nuclideUri from '../../commons-node/nuclideUri';

// Use dummy 0 port for local connections.
const DUMMY_LOCAL_PORT = 0;
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
          return Observable.throw(new Error(`Atom is not connected to host for ${uri}`))
            .publish();
        }
        return openFile(uri, line, column, isWaiting);
      },
      addProject(projectPath: NuclideUri): Promise<void> {
        atom.project.addPath(projectPath);
        return Promise.resolve();
      },
      dispose(): void {
      },
    };

    this._disposables = new ConnectionCache(
        async connection => {
          const service: RemoteCommandServiceType =
            getServiceByConnection(REMOTE_COMMAND_SERVICE, connection);
          const port = connection == null ? DUMMY_LOCAL_PORT : connection.getPort();
          return await service.RemoteCommandService.registerAtomCommands(
            port, this._commands);
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
    goToLocation(uri, line, column)
      .then(editor => {
        atom.applicationDelegate.focusWindow();

        if (
          isWaiting &&
          featureConfig.get('nuclide-remote-atom.shouldNotifyWhenCommandLineIsWaitingOnFile')
        ) {
          const notification = atom.notifications.addInfo(
            `The command line has opened \`${nuclideUri.getPath(uri)}\` and is waiting for it to be closed.`, {
              dismissable: true,
              buttons: [{
                onDidClick: () => {
                  featureConfig.set(
                    'nuclide-remote-atom.shouldNotifyWhenCommandLineIsWaitingOnFile',
                    false,
                  );
                  notification.dismiss();
                },
                text: 'Don\'t show again',
              }, {
                onDidClick: () => {
                  editor.destroy();
                },
                text: 'Close file',
              }],
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
      observeEditorDestroy(editor).map(value => 'close')))
  .publish();
}

export default createPackage(Activation);
