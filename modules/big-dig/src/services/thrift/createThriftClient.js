/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import type {
  ThriftServiceConfig,
  ThriftClient,
  ThrifClientSubscription,
} from './types';

import thrift from 'thrift';
import EventEmitter from 'events';
import {getTransport, getProtocol} from './config-utils';

export class WrappedThriftClient {
  _status: 'CONNECTED' | 'CLOSED_MANUALLY' | 'LOST_CONNECTION';
  _thriftClient: Object;
  _connection: Object;
  _emitter: EventEmitter;

  constructor(connection: Object, client: Object) {
    this._status = 'CONNECTED';
    this._connection = connection;
    this._thriftClient = client;
    this._emitter = new EventEmitter();

    this._connection.on('close', () => {
      if (this._status === 'CONNECTED') {
        this._status = 'LOST_CONNECTION';
        this._emitter.emit('lost_connection');
      }
    });
  }

  getClient<T>(): T {
    switch (this._status) {
      case 'CONNECTED':
        return (this._thriftClient: any);
      case 'CLOSED_MANUALLY':
        throw new Error('Cannot get a closed client');
      case 'LOST_CONNECTION':
        throw new Error('Cannot get a client because connection is closed');
      default:
        (this._status: empty);
        throw new Error('exaustive');
    }
  }

  close(): void {
    if (this._status === 'CONNECTED') {
      this._status = 'CLOSED_MANUALLY';
      this._connection.end();
    }
    this._emitter.removeAllListeners();
  }

  onClientClose(handler: () => mixed): ThrifClientSubscription {
    const cb = () => {
      if (this._status === 'CLOSED_MANUALLY') {
        handler();
      }
    };
    this._connection.on('close', cb);
    return {
      unsubscribe: () => {
        this._connection.removeListener('close', cb);
      },
    };
  }

  onUnexpectedClientFailure(handler: () => mixed): ThrifClientSubscription {
    this._emitter.on('lost_connection', handler);
    return {
      unsubscribe: () => {
        this._emitter.removeListener('lost_connection', handler);
      },
    };
  }
}

export function getWrappedThriftClient(
  serviceConfig: ThriftServiceConfig,
  port: number,
): ThriftClient {
  const connection = thrift.createConnection('localhost', port, {
    transport: getTransport(serviceConfig),
    protocol: getProtocol(serviceConfig),
  });
  const thriftClient = thrift.createClient(
    serviceConfig.thriftService,
    connection,
  );
  return new WrappedThriftClient(connection, thriftClient);
}
