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

import type {BuckWebSocketMessage} from './BuckService';

import {Observable} from 'rxjs';
import {getLogger} from 'log4js';
import WS from 'ws';

export default function createBuckWebSocket(
  httpPort: number,
): Observable<BuckWebSocketMessage> {
  return Observable.create(observer => {
    const uri = `ws://localhost:${httpPort}/ws/build`;
    const socket = new WS(uri);

    socket.on('open', () => {
      // Emit a message so the client knows the socket is ready for Buck events.
      observer.next({type: 'SocketConnected'});
    });

    socket.on('message', data => {
      let message;
      try {
        message = JSON.parse(data);
      } catch (err) {
        getLogger('nuclide-buck-rpc').error(
          'Error parsing Buck websocket message',
          err,
        );
        return;
      }

      observer.next(message);
    });

    socket.on('error', e => {
      observer.error(e);
    });

    socket.on('close', () => {
      observer.complete();
    });

    return () => {
      socket.removeAllListeners();
      socket.close();
    };
  });
}
