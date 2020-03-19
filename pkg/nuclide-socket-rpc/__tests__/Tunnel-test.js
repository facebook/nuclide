/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
import * as Tunnel from '../lib/Tunnel';
import {ConnectionFactory} from '../lib/Connection';
import net from 'net';
import invariant from 'assert';
import {ConnectableObservable} from 'rxjs';
import {getLogger} from 'log4js';

import type {SocketEvent} from '../lib/types.js';

const TEST_PORT = 5004;
const cf = new ConnectionFactory();

describe.skip('createTunnel', () => {
  let td;

  beforeEach(() => {
    getLogger('SocketService-spec').debug('--SPEC START--');
    td = {
      to: {
        host: 'localhost',
        port: TEST_PORT + 1,
        family: 6,
      },
      from: {
        host: 'localhost',
        port: TEST_PORT,
        family: 6,
      },
    };
  });

  afterEach(() => {
    getLogger('SocketService-spec').debug('--SPEC END--');
  });

  it('should set up a listener that a client can connect to', async () => {
    const events = Tunnel.createTunnel(td, new ConnectionFactory());
    let serverListening = false;
    let subscription;

    await new Promise(resolve => {
      subscription = events.refCount().subscribe({
        next: event => {
          if (event.type === 'server_started') {
            serverListening = true;
            resolve();
          }
        },
      });
    });

    expect(serverListening).toBe(true);
    await testConnectability(TEST_PORT);
    invariant(subscription);
    subscription.unsubscribe();
  });

  it('should return a ConnectableObservable that emits listener events', async () => {
    const events: ConnectableObservable<SocketEvent> = Tunnel.createTunnel(
      td,
      cf,
    );
    const eventList = [];

    const subscription = events.refCount().subscribe({
      next: event => {
        eventList.push(event);
      },
    });

    await testConnectability(TEST_PORT);
    subscription.unsubscribe();
    const types = eventList.map(event => event.type);
    expect(types).toContain('server_started');
    expect(types).toContain('client_connected');
    expect(types).toContain('client_disconnected');
  });

  it('should send replies back to the originating client', async done => {
    const message = 'HELLO WORLD';
    let response = null;

    // start echo server
    const echoServer = net.createServer(socket => {
      socket.pipe(socket);
    });
    await new Promise(resolve => {
      echoServer.listen({host: '::', port: TEST_PORT + 1}, resolve);
    });

    // create tunnel
    const subscription = Tunnel.createTunnel(td, cf)
      .refCount()
      .subscribe();

    // create connection and send data
    await new Promise(resolve => {
      const socket = net.createConnection(TEST_PORT, () => {
        socket.on('data', data => {
          response = data.toString();
          resolve();
        });
        socket.write(new Buffer(message));
      });
    });

    expect(message).toEqual(response);
    subscription.unsubscribe();
    invariant(done);
    echoServer.close(done);
  });

  it('should re-tunnel if the port is already bound on a tunnel', async done => {
    let subscription = null;
    await new Promise(resolve => {
      subscription = Tunnel.createTunnel(td, cf)
        .refCount()
        .subscribe({
          next: resolve,
        });
    });

    await new Promise(resolve => {
      subscription = Tunnel.createTunnel(td, cf)
        .refCount()
        .subscribe({
          next: resolve,
        });
    });

    invariant(subscription);
    subscription.unsubscribe();
    invariant(done);
    done();
  });

  it('should stop listening when the observable is unsubscribed', async () => {
    const observable = Tunnel.createTunnel(td, cf);

    await new Promise(resolve => {
      const subscription = observable
        .refCount()
        .take(1)
        .subscribe({
          next: event => {
            resolve(event);
            subscription.unsubscribe();
          },
        });
    });

    await testConnectability(TEST_PORT);
  });

  it('should allow for multiple clients to connect and interact', async done => {
    let toServer;
    const sockets: Array<net.Socket> = [];
    let subscription = null;

    // create the 'to' server
    await new Promise(resolve => {
      toServer = net.createServer(socket => {
        socket.pipe(socket);
      });
      toServer.listen({host: '::', port: TEST_PORT + 1}, resolve);
    });

    await new Promise(resolve => {
      subscription = Tunnel.createTunnel(td, cf)
        .refCount()
        .subscribe({next: resolve});
    });

    await new Promise(resolve => {
      sockets.push(net.createConnection(TEST_PORT, resolve));
    });

    await new Promise(resolve => {
      sockets.push(net.createConnection(TEST_PORT, resolve));
    });

    await new Promise(resolve => {
      sockets.forEach((socket, index) => {
        socket.on('data', data => {
          expect(data.toString()).toEqual('data' + index);
        });
        socket.write(new Buffer('data' + index));
      });
      resolve();
    });

    invariant(subscription);
    subscription.unsubscribe();
    invariant(toServer);
    toServer.close(done);
  });

  it('should handle clients that error out', async done => {
    let subscription = null;
    let toServer;

    // create the 'to' server
    await new Promise(resolve => {
      toServer = net.createServer(socket => {
        socket.pipe(socket);
      });
      toServer.listen({host: '::', port: TEST_PORT + 1}, resolve);
    });

    await new Promise(resolve => {
      subscription = Tunnel.createTunnel(td, cf)
        .refCount()
        .subscribe({next: resolve});
    });

    await new Promise(resolve => {
      const socket = net.createConnection(TEST_PORT, () => {
        socket.destroy(new Error('boom'));
        resolve();
      });
      socket.on('error', () => {});
    });

    invariant(subscription);
    subscription.unsubscribe();
    invariant(toServer);
    toServer.close(done);
  });
});

async function testConnectability(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port);
    socket.on('error', err => reject(err));
    invariant(socket);
    socket.on('connect', async () => {
      socket.write(new Buffer('hello world'));
      socket.on('end', () => resolve());
      socket.end();
    });
  });
}
