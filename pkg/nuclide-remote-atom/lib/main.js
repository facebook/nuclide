/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import typeof * as RemoteCommandServiceType from '../../nuclide-remote-atom-rpc/lib/RemoteCommandService';
import type {
  AtomCommands,
  AtomFileEvent,
  AtomNotification,
  ProjectState,
} from '../../nuclide-remote-atom-rpc/lib/rpc-types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {ConnectableObservable} from 'rxjs';
import type {DeepLinkService} from '../../nuclide-deep-link/lib/types';
import type {RemoteProjectsService} from '../../nuclide-remote-projects';
import {clipboard} from 'electron';

import invariant from 'assert';
import querystring from 'querystring';
import {
  getServiceByConnection,
  ConnectionCache,
} from '../../nuclide-remote-connection';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {goToLocation} from 'nuclide-commons-atom/go-to-location';
import createPackage from 'nuclide-commons-atom/createPackage';
import featureConfig from 'nuclide-commons-atom/feature-config';
import {getLogger} from 'log4js';
import {observeEditorDestroy} from 'nuclide-commons-atom/text-editor';
import {Observable} from 'rxjs';
import {ServerConnection} from '../../nuclide-remote-connection';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {getNotifierByConnection} from '../../nuclide-open-files';
import {shell} from 'electron';
import {restrictLength} from '../../nuclide-remote-atom-rpc/shared/MessageLength';

const REMOTE_COMMAND_SERVICE = 'RemoteCommandService';
const ATOM_URI_ADD_PATH = 'add-path';

class Activation {
  _disposables: UniversalDisposable;
  _commands: AtomCommands;
  _remoteProjectsService: ?RemoteProjectsService;

  constructor() {
    this._disposables = new UniversalDisposable();
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
      async addProject(
        projectPath: NuclideUri,
        newWindow: boolean,
      ): Promise<void> {
        if (nuclideUri.isLocal(projectPath)) {
          atom.applicationDelegate.open({
            pathsToOpen: [projectPath],
            newWindow,
            devMode: atom.devMode,
            safeMode: atom.inSafeMode(),
          });
        } else {
          let queryParams = {
            path: projectPath,
          };
          if (newWindow) {
            queryParams = {...queryParams, target: '_blank'};
          }
          const url =
            `atom://nuclide/${ATOM_URI_ADD_PATH}?` +
            querystring.stringify(queryParams);
          shell.openExternal(url);
        }
      },

      async getProjectState(): Promise<ProjectState> {
        return {
          rootFolders: atom.project.getPaths(),
        };
      },

      addNotification(notification: AtomNotification): Promise<void> {
        const {type, message} = notification;
        const {description, detail, icon, dismissable} = notification;
        const options = {description, detail, icon, dismissable};
        atom.notifications.add(type, message, options);
        return Promise.resolve();
      },

      async getClipboardContents(): Promise<string> {
        return restrictLength(clipboard.readText());
      },

      async setClipboardContents(text: string): Promise<void> {
        clipboard.writeText(text);
      },

      dispose(): void {},
    };

    this._disposables.add(
      new ConnectionCache(async connection => {
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
        return service.registerAtomCommands(fileNotifier, this._commands);
      }),
    );
  }

  consumeRemoteProjectsService(service: RemoteProjectsService): IDisposable {
    this._remoteProjectsService = service;
    const disposable = new UniversalDisposable(() => {
      this._remoteProjectsService = null;
    });
    this._disposables.add(disposable);
    return disposable;
  }

  consumeDeepLinkService(service: DeepLinkService): IDisposable {
    const disposable = service.subscribeToPath(
      ATOM_URI_ADD_PATH,
      async params => {
        const {path: projectPath} = params;
        invariant(typeof projectPath === 'string');
        if (!nuclideUri.isRemote(projectPath)) {
          getLogger(`Expected remote Nuclide URI but got ${projectPath}.`);
          return;
        }

        const remoteProjectsService = this._remoteProjectsService;
        if (remoteProjectsService == null) {
          getLogger('No provider for nuclide-remote-projects was found.');
          return;
        }

        getLogger().info(`Attempting to addProject(${projectPath}).`);
        const hostname = nuclideUri.getHostname(projectPath);
        await remoteProjectsService.createRemoteConnection({
          host: hostname,
          path: nuclideUri.getPath(projectPath),
          displayTitle: hostname,
        });
      },
    );
    this._disposables.add(disposable);
    return disposable;
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
