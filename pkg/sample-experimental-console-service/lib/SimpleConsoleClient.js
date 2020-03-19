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

import type {ServiceConnection} from 'nuclide-commons-atom/experimental-packages/types';

export default class SimpleConsoleClient {
  _connection: ServiceConnection;

  constructor(connection: ServiceConnection) {
    this._connection = connection;
  }

  log(message: string): void {
    this._connection.sendNotification('message', {message});
  }
}
