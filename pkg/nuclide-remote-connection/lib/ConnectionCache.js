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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import {ServerConnection} from './ServerConnection';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {Cache} from 'nuclide-commons/cache';

// A cache of values by ServerConnection.
// Will lazily create the values when requested for each connection.
// Note that an entry is added for local with connection == null.
export class ConnectionCache<T: IDisposable> extends Cache<
  ?ServerConnection,
  Promise<T>,
> {
  _subscriptions: UniversalDisposable;

  // If lazy is true, then entries will only be created when get() is called.
  // Otherwise, entries will be created as soon as ServerConnection's are
  // established.
  constructor(
    factory: (connection: ?ServerConnection) => Promise<T>,
    lazy: boolean = false,
  ) {
    super(factory, valuePromise => valuePromise.then(value => value.dispose()));
    this._subscriptions = new UniversalDisposable();
    this._subscriptions.add(
      ServerConnection.onDidCloseServerConnection(connection => {
        if (this.has(connection)) {
          const value = this.get(connection);
          this.delete(connection);
          value.then(element => element.dispose());
        }
      }),
    );

    if (!lazy) {
      this.get(null);
      this._subscriptions.add(
        ServerConnection.observeConnections(connection => {
          this.get(connection);
        }),
      );
    }
  }

  getForUri(filePath: ?NuclideUri): ?Promise<T> {
    const connection = connectionOfUri(filePath);
    if (connection == null) {
      return null;
    }
    return this.get(connection.connection);
  }

  getExistingForUri(filePath: ?NuclideUri): ?Promise<T> {
    const connection = connectionOfUri(filePath);
    if (connection == null) {
      return null;
    }
    return this.has(connection.connection)
      ? this.get(connection.connection)
      : null;
  }

  dispose(): void {
    super.dispose();
    this._subscriptions.dispose();
  }
}

// Returns null if there's no valid connection for the given filePath
// Returns {connection: null} for a valid local filePath.
// Returns {connection: non-null} for a valid remote filePath.
function connectionOfUri(
  filePath: ?NuclideUri,
): ?{connection: ?ServerConnection} {
  if (filePath == null) {
    return null;
  }

  const connection = ServerConnection.getForUri(filePath);
  // During startup & shutdown of connections we can have a remote uri
  // without the corresponding connection.
  if (connection == null && nuclideUri.isRemote(filePath)) {
    return null;
  }

  return {connection};
}
