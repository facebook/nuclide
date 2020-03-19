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

import invariant from 'assert';
import {IpcServerTransport} from '../lib/IpcTransports';

const transport = new IpcServerTransport();
invariant(!transport.isClosed());

transport.onMessage().subscribe(message => {
  if (message === 'exit') {
    process.exit(0);
  } else {
    transport.send(message.toUpperCase());
  }
});
