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

import * as SocketService from '../lib/SocketService';
import net from 'net';

const TEST_PORT = 5000;

describe('SocketService', () => {
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
    observable.connect();

    waitsForPromise(async () => {
      await observable
        .filter(value => value.type === 'server_started')
        .take(1)
        .toPromise();
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
      await observable
        .filter(value => value.type === 'client_connected')
        .take(1)
        .toPromise();
      client.end();
      await observable
        .takeWhile(value => value.type === 'client_disconnected')
        .take(1)
        .toPromise();

      SocketService.stopListening(TEST_PORT);
      expect(await events).toEqual([
        {type: 'server_started'},
        {type: 'client_connected'},
        {type: 'client_disconnected'},
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
      await observable
        .filter(value => value.type === 'client_connected')
        .take(1)
        .toPromise();
      SocketService.closeClient(TEST_PORT);
      await observable
        .takeWhile(value => value.type === 'client_disconnected')
        .take(1)
        .toPromise();

      SocketService.stopListening(TEST_PORT);
      expect(await events).toEqual([
        {type: 'server_started'},
        {type: 'client_connected'},
        {type: 'client_disconnected'},
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
      await observable
        .filter(value => value.type === 'client_connected')
        .take(1)
        .toPromise();
      SocketService.clientError(TEST_PORT, 'shucks');
      await observable
        .takeWhile(value => value.type === 'client_disconnected')
        .take(1)
        .toPromise();

      SocketService.stopListening(TEST_PORT);
      expect(await events).toEqual([
        {type: 'server_started'},
        {type: 'client_connected'},
        {type: 'client_disconnected'},
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
      await observable
        .filter(value => value.type === 'client_connected')
        .take(1)
        .toPromise();
      client.destroy(new Error('boom'));
      await observable
        .takeWhile(value => value.type === 'client_disconnected')
        .take(1)
        .toPromise();

      SocketService.stopListening(TEST_PORT);
      expect(await events).toEqual([
        {type: 'server_started'},
        {type: 'client_connected'},
        {type: 'client_disconnected'},
        {type: 'server_stopping'},
      ]);
    });
  });
});
