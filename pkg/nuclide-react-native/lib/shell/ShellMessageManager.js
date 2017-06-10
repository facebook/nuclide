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

import WS from 'ws';

const EXECUTOR_PORT = 8081;
const WS_URL = `ws://localhost:${EXECUTOR_PORT}/message?role=interface&name=Nuclide`;

export class ShellMessageManager {
  _url: string;
  _ws: ?WS;

  constructor() {
    this._url = WS_URL;
  }

  send(message: Object): void {
    if (this._ws == null) {
      // Currently, use cases only require a simple fire-and-forget interaction
      const ws = new WS(this._url);
      this._ws = ws;
      ws.onopen = () => {
        ws.send(JSON.stringify(message));
        ws.close();
      };
      ws.onerror = () => {
        atom.notifications.addWarning(
          'Error connecting to React Native shell.',
        );
      };
      ws.onclose = () => {
        this._ws = null;
      };
    }
  }
}
