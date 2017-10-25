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

import type {Observable} from 'rxjs';
import type {ObjectRegistry} from './ObjectRegistry';

export {ServiceRegistry} from './ServiceRegistry';
export {RpcConnection, RpcTimeoutError} from './RpcConnection';
export {LoopbackTransports} from './LoopbackTransports';
export {StreamTransport} from './StreamTransport';
export {SocketTransport} from './SocketTransport';
export {SocketServer} from './SocketServer';
export {RpcProcess} from './RpcProcess';

import loadServicesConfig from './loadServicesConfig';
export {loadServicesConfig};

export type MessageLogger = (
  direction: 'send' | 'receive',
  message: string,
) => void;

export type ConfigEntry = {
  name: string,
  definition: string,
  implementation: string,
  // When true, doesn't mangle in the service name into the method names for functions.
  preserveFunctionNames?: boolean,
};

export type NamedTransformer = (
  value: any,
  context: ObjectRegistry,
) => any | Promise<any>;

export type PredefinedTransformer = {
  typeName: string,
  marshaller: NamedTransformer,
  unmarshaller: NamedTransformer,
};

export type Transport = {
  send(message: string): void,
  onMessage(): Observable<string>,
  close(): void,
  isClosed(): boolean,
};

// An unreliable transport for sending JSON formatted messages
// onClose handlers are guaranteed to be called exactly once.
// onMessage handlers are guaranteed to not be called after onClose has been called.
// send(data) yields false if the message failed to send, true on success.
// (note that successfull sending doesn't imply successfull delivery...)
// onClose handlers will be called before close() returns.
// May not call send() after transport has closed..
export type UnreliableTransport = {
  send(message: string): Promise<boolean>,
  onClose(callback: () => mixed): IDisposable,
  onMessage(): Observable<string>,
  onError(callback: (error: Object) => mixed): IDisposable,
  close(): void,
  isClosed(): boolean,
};

// There are two implementation attempts at a reliable transport that satisfy
// the following interface - QueuedTransport (known to be unreliable in cases),
// and QueuedAckTransport (new as of Oct2017, not greatly tested). The GK
// 'nuclide_connection_ack' will opt you into the latter. If it proves itself
// then we can deleted QueuedTransport and the following interface entirely.
export type ReliableTransport = {
  send(message: string): void,
  onMessage(): Observable<string>,
  close(): void,
  isClosed(): boolean,
  getState(): 'open' | 'disconnected' | 'closed',
  reconnect(transport: UnreliableTransport): void,
  getLastStateChangeTime(): number,
  id: string,
};

(((null: any): ReliableTransport): Transport);
