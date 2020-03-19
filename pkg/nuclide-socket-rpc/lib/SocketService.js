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

import * as Tunnel from './Tunnel';
import {ConnectionFactory} from './Connection';
import {getAvailableServerPort as _getAvailableServerPort} from 'nuclide-commons/serverPort';

import type {ResolvedTunnel} from 'nuclide-adb/lib/types';
import type {ConnectableObservable} from 'rxjs';
import type {SocketEvent} from './types';

/**
 * The role of the Connection Factory is to create
 * connections on the remote host. There is no easy
 * built-in way to do this with the current RPC framework
 */
export function getConnectionFactory(): Promise<ConnectionFactory> {
  return Promise.resolve(new ConnectionFactory());
}

export function createTunnel(
  t: ResolvedTunnel,
  cf: ConnectionFactory,
): ConnectableObservable<SocketEvent> {
  return Tunnel.createTunnel(t, cf);
}

export async function getAvailableServerPort(): Promise<number> {
  return _getAvailableServerPort();
}
