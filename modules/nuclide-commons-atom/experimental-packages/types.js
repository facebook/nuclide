/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import type {MessageConnection} from 'vscode-jsonrpc';
import type {Socket as Socket_} from './MessageRouter'; // eslint-disable-line nuclide-internal/import-type-style

export type Socket = Socket_;

export type ExperimentalPackageDefinition = {
  main: string,
  // Allows the package to run in the Atom renderer process.
  // Should only be used when absolutely necessary!
  runInAtom_UNSAFE?: boolean,
  consumedServices?: {
    [alias: string]: {|
      name: string,
      version: string,
      config?: Object,
    |},
  },
  providedServices?: {
    [alias: string]: {|
      name: string,
      version: string,
      // The `client` specifies a path to a module that exports a single function which accepts a
      // JsonRpcConnection and returns the object that's provided to packages that consume the
      // service.
      client: string,
      // In the future, we may allow for a server to be specified here as well. If it is, it will be
      // used to wrap the array of connections passed to the package and that will be passed
      // instead. There isn't a *huge* benefit to this, but it would provide a typed interface and
      // could be generated.
    |},
  },
};

type ProvidedServices = {
  [key: string]: {|
    rawConnections: Array<{|socket: Socket, config: Object|}>,
  |},
};

type ConsumedServices = {
  [key: string]: {|
    socket: Socket,
    // Path to JS module that creates the client object.
    client: string,
  |},
};

export type PackageParams = {|
  main: string,
  providedServices: ProvidedServices,
  consumedServices: ConsumedServices,
|};

export interface PackageRunner {
  activate(): void;
  dispose(): void;

  onDidError(callback: (error: Error) => mixed): IDisposable;
}

export type ServiceConnection = MessageConnection & {config: Object};

// Each JSON-RPC message comes from a socket.
// Include the socket as a field in the message.
export type PipedMessage = {
  socket: Socket,
};

export type InitializeMessage = {|
  packages: Array<PackageParams>,
  exposedSockets: Array<Socket>,
|};
