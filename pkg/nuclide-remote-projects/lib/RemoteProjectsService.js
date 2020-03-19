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

import type {SerializableRemoteConnectionConfiguration} from '..';
import type {StartConnectFlowOptions} from './startConnectFlow';
import type {RemoteConnectionConfiguration} from '../../nuclide-remote-connection/lib/RemoteConnection';
import type {SimpleConnectConfiguration} from './SimpleConnect';

import {ReplaySubject} from 'rxjs';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {RemoteConnection} from '../../nuclide-remote-connection';
import startConnectFlow from './startConnectFlow';
import {connectToServer} from './SimpleConnect';
import {getLogger} from 'log4js';

export default class RemoteProjectsService {
  _subject: ReplaySubject<Array<string>>;

  constructor() {
    this._subject = new ReplaySubject(1);
  }

  dispose() {
    this._subject.complete();
  }

  _reloadFinished(projects: Array<string>) {
    this._subject.next(projects);
    this._subject.complete();
  }

  waitForRemoteProjectReload(
    callback: (loadedProjects: Array<string>) => mixed,
  ): IDisposable {
    return new UniversalDisposable(this._subject.subscribe(callback));
  }

  createRemoteConnection = (
    config: SerializableRemoteConnectionConfiguration,
  ): Promise<?RemoteConnection> => {
    return this._connect(config, false);
  };

  /**
   * This function intentially returns `void` and handles errors because it's intended to
   * encapsulate the entire workflow.
   */
  connect(config: SerializableRemoteConnectionConfiguration): void {
    this._connect(config, true).catch(err => {
      atom.notifications.addError(
        'There was an error connecting to the remote project.',
        {dismissable: true, detail: err.message},
      );
      getLogger('nuclide-remote-projects').error(err);
    });
  }

  async _connect(
    remoteProjectConfig: SerializableRemoteConnectionConfiguration,
    attemptImmediateConnection: boolean,
  ): Promise<?RemoteConnection> {
    const {
      host,
      path,
      displayTitle,
      promptReconnectOnFailure = true,
    } = remoteProjectConfig;
    const connection = await RemoteConnection.reconnect(
      host,
      path,
      displayTitle,
      promptReconnectOnFailure,
    );
    if (connection != null) {
      return connection;
    }
    if (promptReconnectOnFailure === false) {
      return null;
    }
    // If connection fails using saved config, open connect dialog.
    return startConnectFlow({
      initialServer: host,
      initialCwd: path,
      attemptImmediateConnection,
    });
  }

  connectToServer(config: SimpleConnectConfiguration): void {
    return connectToServer(config);
  }

  openConnectionDialog(
    options?: StartConnectFlowOptions,
  ): Promise<?RemoteConnection> {
    return startConnectFlow(options);
  }

  async findOrCreate(
    config: RemoteConnectionConfiguration,
  ): Promise<RemoteConnection> {
    return RemoteConnection.findOrCreate(config);
  }
}
