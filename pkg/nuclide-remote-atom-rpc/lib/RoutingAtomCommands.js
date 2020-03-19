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
  AtomFileEvent,
  AtomNotification,
  MultiConnectionAtomCommands,
  ProjectState,
} from './rpc-types';
import type {CommandServer} from './CommandServer';
import type {ConnectableObservable} from 'rxjs';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import {Observable} from 'rxjs';
import {timeoutPromise} from 'nuclide-commons/promise';

/**
 * Timeout to use when making a getProjectState() RPC.
 * Note this is less than the server's default timeout of 60s.
 */
const GET_PROJECT_STATES_TIMEOUT_MS = 10 * 1000;

/**
 * Implementation of MultiConnectionAtomCommands that routes requests
 * to the appropriate connection from the underlying CommandServer.
 */
export class RoutingAtomCommands implements MultiConnectionAtomCommands {
  _server: CommandServer;

  constructor(server: CommandServer) {
    this._server = server;
  }

  getConnectionCount(): Promise<number> {
    return Promise.resolve(this._server.getConnectionCount());
  }

  openFile(
    filePath: NuclideUri,
    line: number,
    column: number,
    isWaiting: boolean,
  ): ConnectableObservable<AtomFileEvent> {
    const commands = this._server.getAtomCommandsByPath(filePath);
    if (commands != null) {
      return commands.openFile(filePath, line, column, isWaiting);
    } else {
      return Observable.throw(Error('No connected Atom windows')).publish();
    }
  }

  openRemoteFile(
    uri: string,
    line: number,
    column: number,
    isWaiting: boolean,
  ): ConnectableObservable<AtomFileEvent> {
    const commands = this._server.getAtomCommandsByPath(uri);
    if (commands != null) {
      return commands.openRemoteFile(uri, line, column, isWaiting);
    } else {
      return Observable.throw(Error('No connected Atom windows')).publish();
    }
  }

  addProject(projectPath: NuclideUri, newWindow: boolean): Promise<void> {
    const commands = this._server.getAtomCommandsByPath(projectPath);
    if (commands != null) {
      return commands.addProject(projectPath, newWindow);
    } else {
      throw new Error('No connected Atom windows');
    }
  }

  async getProjectStates(): Promise<Array<ProjectState>> {
    const projectStates = [];
    for (const connection of this._server.getConnections()) {
      // Just in case the connection is no longer valid, we wrap it with a
      // timeout less than Nuclide RPC's default of 60s. We swallow any
      // errors and return an empty ProjectState if this happens.
      projectStates.push(
        timeoutPromise(
          connection.getAtomCommands().getProjectState(),
          GET_PROJECT_STATES_TIMEOUT_MS,
        ).catch(error => ({
          rootFolders: [],
        })),
      );
    }
    const resolvedProjectStates = await Promise.all(projectStates);
    return [].concat(...resolvedProjectStates);
  }

  async addNotification(notification: AtomNotification): Promise<void> {
    const promises = [];
    for (const connection of this._server.getConnections()) {
      promises.push(connection.getAtomCommands().addNotification(notification));
    }
    await Promise.all(promises);
  }

  getClipboardContents(): Promise<string> {
    const commands = this._server.getDefaultAtomCommands();
    if (commands != null) {
      return commands.getClipboardContents();
    } else {
      throw new Error('No connected Atom windows');
    }
  }

  setClipboardContents(text: string): Promise<void> {
    const commands = this._server.getDefaultAtomCommands();
    if (commands != null) {
      return commands.setClipboardContents(text);
    } else {
      throw new Error('No connected Atom windows');
    }
  }

  dispose() {}
}
