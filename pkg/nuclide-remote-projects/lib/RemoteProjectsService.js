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

import type {SerializableRemoteConnectionConfiguration} from '..';
import type {OpenConnectionDialogOptions} from './open-connection';
import type {
  RemoteConnectionConfiguration,
} from '../../nuclide-remote-connection/lib/RemoteConnection';

import {ReplaySubject} from 'rxjs';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {RemoteConnection} from '../../nuclide-remote-connection';
import {openConnectionDialog} from './open-connection';

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

  async createRemoteConnection(
    remoteProjectConfig: SerializableRemoteConnectionConfiguration,
  ): Promise<?RemoteConnection> {
    const {host, cwd, displayTitle} = remoteProjectConfig;
    let connection = RemoteConnection.getByHostnameAndPath(host, cwd);
    if (connection != null) {
      return connection;
    }

    connection = await RemoteConnection.createConnectionBySavedConfig(
      host,
      cwd,
      displayTitle,
    );
    if (connection != null) {
      return connection;
    }

    // If connection fails using saved config, open connect dialog.
    return openConnectionDialog({
      initialServer: host,
      initialCwd: cwd,
    });
  }

  openConnectionDialog(
    options: OpenConnectionDialogOptions,
  ): Promise<?RemoteConnection> {
    return openConnectionDialog(options);
  }

  async findOrCreate(
    config: RemoteConnectionConfiguration,
  ): Promise<RemoteConnection> {
    return RemoteConnection.findOrCreate(config);
  }
}
