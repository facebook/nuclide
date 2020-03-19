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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {ConnectableObservable} from 'rxjs';

export type ProjectState = {
  /**
   * This is the raw value of atom.project.getPaths(). It can
   * contain a mix of absolute paths that are local to the machine
   * where Atom is running in addition to nuclide:// URIs.
   */
  rootFolders: Array<string>,
};

export type AtomFileEvent = 'open' | 'close';

export type AtomNotificationType =
  | 'success'
  | 'info'
  | 'warning'
  | 'error'
  | 'fatal';

export type AtomNotification = {
  message: string,
  type: AtomNotificationType,
  description?: string,
  detail?: string,
  icon?: string,
  dismissable?: boolean,
};

/**
 * Collection of client-side actions in Atom that can be invoked from
 * a Nuclide server. Each Atom window will register its own instance
 * of AtomCommands that it implements.
 */
export interface AtomCommands {
  openFile(
    // Path local to the machine that made the call to openFile().
    filePath: NuclideUri,
    line: number,
    column: number,
    isWaiting: boolean,
  ): ConnectableObservable<AtomFileEvent>;
  openRemoteFile(
    // This is a remote NuclideUri. It is typed as a string so that it does not
    // get converted as part of Nuclide-RPC.
    uri: string,
    line: number,
    column: number,
    isWaiting: boolean,
  ): ConnectableObservable<AtomFileEvent>;

  /**
   * The returned Promise may resolve before the project is added to Atom if
   * newWindow is true.
   */
  addProject(projectPath: NuclideUri, newWindow: boolean): Promise<void>;

  /**
   * Returns information about the Atom windows that have a Nuclide server
   * connection to this AtomCommands.
   */
  getProjectState(): Promise<ProjectState>;

  addNotification(notification: AtomNotification): Promise<void>;

  /**
   * Returns contents of clipboard.
   */
  getClipboardContents(): Promise<string>;

  /**
   * Sets contents of clipboard.
   */
  setClipboardContents(text: string): Promise<void>;

  dispose(): void;
}

/**
 * Router that forwards requests to the appropriate AtomCommands object, if
 * any. Some methods, like openFile(), can be mapped to an AtomCommands based
 * on a NuclideUri parameter. Other methods, like getClientConnections(),
 * require consulting multiple AtomCommands objects.
 */
export interface MultiConnectionAtomCommands {
  /** @return the number of AtomCommands registered with this object. */
  getConnectionCount(): Promise<number>;

  /**
   * The ConnectableObservable will throw if there are no connected Atom
   * windows where the file can be opened.
   */
  openFile(
    // Path local to the machine that made the call to openFile().
    filePath: NuclideUri,
    line: number,
    column: number,
    isWaiting: boolean,
  ): ConnectableObservable<AtomFileEvent>;

  /**
   * The ConnectableObservable will throw if there are no connected Atom
   * windows where the file can be opened.
   */
  openRemoteFile(
    // This is a remote NuclideUri. It is typed as a string so that it does not
    // get converted as part of Nuclide-RPC.
    uri: string,
    line: number,
    column: number,
    isWaiting: boolean,
  ): ConnectableObservable<AtomFileEvent>;

  /**
   * The returned Promise may resolve before the project is added to Atom if
   * newWindow is true.
   *
   * The Promise will reject if there are no connected Atom clients where
   * project can be added.
   */
  addProject(projectPath: NuclideUri, newWindow: boolean): Promise<void>;

  /**
   * Returns information about each Atom window that has a connection to this
   * Nuclide server.
   */
  getProjectStates(): Promise<Array<ProjectState>>;

  /**
   * Sends the specified notification to all connected windows.
   */
  addNotification(notification: AtomNotification): Promise<void>;

  /**
   * Returns contents of clipboard.
   */
  getClipboardContents(): Promise<string>;

  /**
   * Sets contents of clipboard.
   */
  setClipboardContents(text: string): Promise<void>;

  dispose(): void;
}

export type ConnectionDetails = {
  port: number,
  family: string,
};
