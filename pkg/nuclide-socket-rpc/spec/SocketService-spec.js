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

import {getLogger} from 'log4js';
import * as SocketService from '../lib/SocketService';
import net from 'net';
import invariant from 'assert';

const TEST_PORT = 5000;

describe('SocketService', () => {
  beforeEach(() => {
    getLogger('SocketService-spec').debug('--SPEC START--');
  });

  afterEach(() => {
    getLogger('SocketService-spec').debug('--SPEC END--');
  });

  it('completes the observable when listening is done', () => {
    waitsForPromise(async () => {
      const observable = SocketService.startListening(TEST_PORT);
      observable.connect();
      await observable
        .filter(value => value.type === 'server_started')
        .take(1)
        .toPromise();
      SocketService.stopListening(TEST_PORT);
      await observable.toPromise();
    });
  });

  it('throws an error if the port is already bound', () => {
    const observable = SocketService.startListening(TEST_PORT);
    const serverStart = observable
      .filter(value => value.type === 'server_started')
      .take(1)
      .toPromise();
    observable.connect();

    waitsForPromise(async () => {
      await serverStart;
    });

    waitsForPromise({shouldReject: true}, async () => {
      const failing = SocketService.startListening(TEST_PORT);
      failing.connect();
      await failing.toPromise();
    });

    waitsForPromise(async () => {
      SocketService.stopListening(TEST_PORT);
      await observable.toPromise();
    });
  });

  it("doesn't throw an error if the port is released and bound later", () => {
    waitsForPromise(async () => {
      let observable = SocketService.startListening(TEST_PORT);
      observable.connect();
      await observable
        .filter(value => value.type === 'server_started')
        .take(1)
        .toPromise();
      SocketService.stopListening(TEST_PORT);
      await observable.toPromise();
      observable = SocketService.startListening(TEST_PORT);
      observable.connect();
      await observable
        .filter(value => value.type === 'server_started')
        .take(1)
        .toPromise();
      SocketService.stopListening(TEST_PORT);
      await observable.toPromise();
    });
  });

  it('sends client connection events', () => {
    waitsForPromise(async () => {
      const observable = SocketService.startListening(TEST_PORT);
      const events = observable.toArray().toPromise();
      observable.connect();

      const client = net.connect(TEST_PORT);
      const connectEvent = await observable
        .filter(value => value.type === 'client_connected')
        .take(1)
        .toPromise();
      client.end();
      invariant(connectEvent.type === 'client_connected');
      await observable
        .takeWhile(value => value.type === 'client_disconnected')
        .take(1)
        .toPromise();

      SocketService.stopListening(TEST_PORT);
      expect(await events).toEqual([
        {type: 'server_started'},
        {type: 'client_connected', clientPort: connectEvent.clientPort},
        {type: 'client_disconnected', clientPort: connectEvent.clientPort},
        {type: 'server_stopping'},
      ]);
    });
  });

  it('can disconnect clients', () => {
    waitsForPromise(async () => {
      const observable = SocketService.startListening(TEST_PORT);
      const events = observable.toArray().toPromise();
      observable.connect();

      net.connect(TEST_PORT);
      const connectEvent = await observable
        .filter(value => value.type === 'client_connected')
        .take(1)
        .toPromise();
      invariant(connectEvent.type === 'client_connected');
      SocketService.closeClient(TEST_PORT, connectEvent.clientPort);
      await observable
        .takeWhile(value => value.type === 'client_disconnected')
        .take(1)
        .toPromise();

      SocketService.stopListening(TEST_PORT);
      expect(await events).toEqual([
        {type: 'server_started'},
        {type: 'client_connected', clientPort: connectEvent.clientPort},
        {type: 'client_disconnected', clientPort: connectEvent.clientPort},
        {type: 'server_stopping'},
      ]);
    });
  });

  it('can connect multiple clients', () => {
    waitsForPromise(async () => {
      const observable = SocketService.startListening(TEST_PORT);
      const events = observable.toArray().toPromise();
      observable.connect();

      net.connect(TEST_PORT);
      const connectEvent1 = await observable
        .filter(value => value.type === 'client_connected')
        .take(1)
        .toPromise();
      invariant(connectEvent1.type === 'client_connected');

      net.connect(TEST_PORT);
      const connectEvent2 = await observable
        .filter(value => value.type === 'client_connected')
        .take(1)
        .toPromise();
      invariant(connectEvent2.type === 'client_connected');

      SocketService.closeClient(TEST_PORT, connectEvent2.clientPort);
      await observable
        .takeWhile(value => value.type === 'client_disconnected')
        .take(1)
        .toPromise();
      SocketService.closeClient(TEST_PORT, connectEvent1.clientPort);
      await observable
        .takeWhile(value => value.type === 'client_disconnected')
        .take(1)
        .toPromise();

      SocketService.stopListening(TEST_PORT);
      expect(await events).toEqual([
        {type: 'server_started'},
        {type: 'client_connected', clientPort: connectEvent1.clientPort},
        {type: 'client_connected', clientPort: connectEvent2.clientPort},
        {type: 'client_disconnected', clientPort: connectEvent2.clientPort},
        {type: 'client_disconnected', clientPort: connectEvent1.clientPort},
        {type: 'server_stopping'},
      ]);
    });
  });

  it('can error out clients', () => {
    waitsForPromise(async () => {
      const observable = SocketService.startListening(TEST_PORT);
      const events = observable.toArray().toPromise();
      observable.connect();

      net.connect(TEST_PORT);
      const connectEvent = await observable
        .filter(value => value.type === 'client_connected')
        .take(1)
        .toPromise();
      invariant(connectEvent.type === 'client_connected');
      SocketService.clientError(TEST_PORT, connectEvent.clientPort, 'shucks');
      await observable
        .takeWhile(value => value.type === 'client_disconnected')
        .take(1)
        .toPromise();

      SocketService.stopListening(TEST_PORT);
      expect(await events).toEqual([
        {type: 'server_started'},
        {type: 'client_connected', clientPort: connectEvent.clientPort},
        {type: 'client_disconnected', clientPort: connectEvent.clientPort},
        {type: 'server_stopping'},
      ]);
    });
  });

  it('can handle clients erroring out', () => {
    waitsForPromise(async () => {
      const observable = SocketService.startListening(TEST_PORT);
      const events = observable.toArray().toPromise();
      observable.connect();

      const client = net.connect(TEST_PORT);
      client.on('error', error => {});
      const connectEvent = await observable
        .filter(value => value.type === 'client_connected')
        .take(1)
        .toPromise();
      invariant(connectEvent.type === 'client_connected');
      client.destroy(new Error('boom'));
      await observable
        .takeWhile(value => value.type === 'client_disconnected')
        .take(1)
        .toPromise();

      SocketService.stopListening(TEST_PORT);
      expect(await events).toEqual([
        {type: 'server_started'},
        {type: 'client_connected', clientPort: connectEvent.clientPort},
        {type: 'client_disconnected', clientPort: connectEvent.clientPort},
        {type: 'server_stopping'},
      ]);
    });
  });
});
