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

import type {ResolvedTunnel} from 'nuclide-adb/lib/types';
import type {ActiveTunnel} from './types';

import {List, Map} from 'immutable';

// A thin wrapper around Immutable.Map with a key factory
export class ActiveTunnels {
  _storage: Map<string, ActiveTunnel>;

  constructor(storage: Map<string, ActiveTunnel> = Map()) {
    this._storage = storage;
  }

  get = (tunnel: ResolvedTunnel): ?ActiveTunnel => {
    return this._storage.get(this._keyForTunnel(tunnel));
  };

  set = (tunnel: ResolvedTunnel, value: ActiveTunnel): ActiveTunnels => {
    const key = this._keyForTunnel(tunnel);
    return new ActiveTunnels(this._storage.set(key, value));
  };

  toList = (): List<ActiveTunnel> => {
    return this._storage.toList();
  };

  update = (
    tunnel: ResolvedTunnel,
    updater: ActiveTunnel => ActiveTunnel,
  ): ActiveTunnels => {
    const key = this._keyForTunnel(tunnel);
    return new ActiveTunnels(
      this._storage.update(key, value => updater(value)),
    );
  };

  delete = (tunnel: ResolvedTunnel): ActiveTunnels => {
    const key = this._keyForTunnel(tunnel);
    return new ActiveTunnels(this._storage.delete(key));
  };

  _keyForTunnel = (resolved: ResolvedTunnel): string => {
    return `${resolved.from.host}:${resolved.from.port}:${
      resolved.from.family
    }->${resolved.to.host}:${resolved.to.port}:${resolved.to.family}`;
  };
}
