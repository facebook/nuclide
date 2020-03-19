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

export type Transport = {
  send(message: string): void,
  onMessage(): Observable<string>,
  close(): void,
  isClosed(): boolean,
};
