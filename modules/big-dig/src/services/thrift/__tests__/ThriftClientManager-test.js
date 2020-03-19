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
 * @emails oncall+nuclide
 */
import type {ThriftServiceConfig, ThrifClientSubscription} from '../types';

import {Observable, Subject} from 'rxjs';
import {getMock} from '../../../../../../jest/jest_mock_utils';
import {TunnelManager} from '../../tunnel/TunnelManager';
import {ThriftClientManager, setTimeoutLimit} from '../ThriftClientManager';
import thrift from 'thrift';
import {encodeMessage, decodeMessage} from '../util';
import EventEmitter from 'events';
import waitsFor from '../../../../../../jest/waits_for';

jest.mock(require.resolve('../createThriftClient'));
jest.mock(require.resolve('../../tunnel/TunnelManager'), () => {
  class MockTunnelManager {
    createTunnel = jest.fn().mockReturnValue({
      getConfig: jest.fn().mockReturnValue({local: {port: 1}}),
      close: jest.fn(),
    });
  }
  return {
    TunnelManager: MockTunnelManager,
  };
});

import {getWrappedThriftClient} from '../createThriftClient';

export class MockedWrappedThriftClient {
  _client: Object;
  _clientId: string;
  _connection: Object;

  constructor(clientId: string, connection: Object, client: Object) {
    this._connection = connection;
    this._client = client;
    this._clientId = clientId;
  }
  getClient<T>(): T {
    return (this._client: any);
  }
  close(): void {
    this._connection.end();
  }

  onClientClose(handler: () => void): ThrifClientSubscription {
    this._connection.on('end', handler);
    return {
      unsubscribe: () => {},
    };
  }

  onUnexpectedClientFailure(handler: () => void): ThrifClientSubscription {
    this._connection.on('lost_connection', handler);
    return {
      unsubscribe: () => {},
    };
  }
}

/**
 * create new client process:  create server -> create tunnel -> create client
 */
describe('ThriftClientManager', () => {
  let mockedTransport;
  let mockedTunnelManager;
  let manager;
  let serverMessage;
  let clientMessage;

  const mockedServiceConfig = {
    name: 'thrift-rfs',
    remoteUri: '',
    remoteCommand: '',
    remoteCommandArgs: [],
    remoteConnection: {
      type: 'tcp',
      port: 0,
    },
    thriftTransport: 'buffered',
    thriftProtocol: 'binary',
    thriftService: {},
    killOldThriftServerProcess: true,
  };

  beforeEach(() => {
    class MockedTransport {
      onMessage(): Observable<string> {
        // Do not use Observable.of(message) here, which will immediately fire
        // event, use Subject() instead so that we have more controls on it.
        return serverMessage;
      }
      send(message: string): void {
        clientMessage.next(message);
      }
    }

    serverMessage = new Subject();
    clientMessage = new Subject();
    mockedTransport = new MockedTransport();
    mockedTunnelManager = new TunnelManager(new MockedTransport());
    manager = new ThriftClientManager(mockedTransport, mockedTunnelManager);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('create thrift client Case 1: failed to start server', async () => {
    clientMessage
      .do(message => {
        serverMessage.next(
          JSON.stringify({
            id: decodeMessage(message).id,
            payload: {
              type: 'response',
              success: false, // failed to create server
              error: 'failed to start server',
            },
          }),
        );
      })
      .subscribe();
    await expect(
      manager.createThriftClient(mockedServiceConfig),
    ).rejects.toThrow('failed to start server');
  });

  it('create thrift client Case 2: failed to create tunnel', async () => {
    // successfully create remote thrift server
    mockClientServerCommunication(clientMessage, serverMessage);
    // mock failed to create tunnel
    const mockedFailureMessage = 'failed to create tunnel';
    // wow, mocked a mock!
    jest
      .spyOn(mockedTunnelManager, 'createTunnel')
      .mockImplementation(async (...args) => {
        return Promise.reject(new Error(mockedFailureMessage));
      });
    manager = new ThriftClientManager(mockedTransport, mockedTunnelManager);
    await expect(
      manager.createThriftClient(mockedServiceConfig),
    ).rejects.toThrow(mockedFailureMessage);
  });

  it('create thrift client Case 3: failed to create client', async () => {
    // successfully create remote thrift server
    mockClientServerCommunication(clientMessage, serverMessage);
    // mock failed to create tunnel
    const mockedFailureMessage = 'failed to create thrift client';
    getMock(getWrappedThriftClient).mockImplementation((...args) => {
      throw new Error(mockedFailureMessage);
    });
    manager = new ThriftClientManager(mockedTransport, mockedTunnelManager);
    await expect(
      manager.createThriftClient(mockedServiceConfig),
    ).rejects.toThrow(mockedFailureMessage);
  });

  it('invoke remote method request timeout', async () => {
    // delay mocked server message, longer than timeout limit
    const TIME_INTERVAL = 20000;
    // make ThriftClientManager _invokeRemoteMethod timeout really short
    setTimeoutLimit(10);
    clientMessage
      .do(message => {
        setTimeout(() => {
          serverMessage.next(
            encodeMessage({
              id: JSON.parse(message).id,
              payload: {
                type: 'response',
                success: true,
                port: '9000',
              },
            }),
          );
        }, TIME_INTERVAL);
      })
      .subscribe();

    await expect(
      manager.createThriftClient(mockedServiceConfig),
    ).rejects.toThrow(/Service:[\s\S]+command:[\s\S]+timeout/);
  });

  it('successfully start a client', async () => {
    const mockedClient = {
      onClientClose: () => {},
      onUnexpectedClientFailure: () => {},
    };
    getMock(getWrappedThriftClient).mockReturnValue(mockedClient);
    mockClientServerCommunication(clientMessage, serverMessage);
    const client = await manager.createThriftClient(mockedServiceConfig);
    expect(client).toBe(mockedClient);
  });

  it('reuse existing tunnel', async () => {
    // create the first client -> create new tunnel and new server
    getMock(getWrappedThriftClient).mockReturnValue({
      onClientClose: () => {},
      onUnexpectedClientFailure: () => {},
    });
    mockClientServerCommunication(clientMessage, serverMessage);
    await manager.createThriftClient(mockedServiceConfig);

    // create second client
    const callServer = jest.fn();
    clientMessage.subscribe(callServer);
    await manager.createThriftClient(mockedServiceConfig);
    expect(callServer).not.toHaveBeenCalled();
  });

  it('stop server used by multiple clients', async () => {
    class MockedConnection extends EventEmitter {
      end() {
        this.emit('end');
      }
    }
    const mockedConnection1 = new MockedConnection();
    const mockedConnection2 = new MockedConnection();
    jest
      .spyOn(thrift, 'createClient')
      .mockImplementationOnce(() => {})
      .mockImplementationOnce(() => {});
    jest
      .spyOn(thrift, 'createConnection')
      .mockImplementationOnce(() => mockedConnection1)
      .mockImplementationOnce(() => mockedConnection2);
    mockClientServerCommunication(clientMessage, serverMessage);
    // mock createThriftClient
    getMock(getWrappedThriftClient).mockImplementation(
      (clientId: string, serviceConfig: ThriftServiceConfig, port: number) => {
        const mockedConnection = thrift.createConnection();
        const mockedClient = thrift.createClient();
        return new MockedWrappedThriftClient(
          clientId,
          mockedConnection,
          mockedClient,
        );
      },
    );
    // monitor calls to server
    const callServer = jest.fn();
    clientMessage.subscribe(callServer);

    // 1. create the first client
    const client1 = await manager.createThriftClient(mockedServiceConfig);
    expect(callServer).toHaveBeenCalledTimes(1);

    // 2. create the second client, since we reuse tunnel and server, so still called once
    const client2 = await manager.createThriftClient(mockedServiceConfig);
    expect(callServer).toHaveBeenCalledTimes(1);

    // 3.stop client2, only reduce tunnel refCount, not yet need to stop server
    client2.close();
    expect(callServer).toHaveBeenCalledTimes(1);

    // 4. stop client1, tunnel refCount reduce to 0, need to stop server this time
    client1.close();
    expect(callServer).toHaveBeenCalledTimes(2);
  });

  // test plan: create two clients of the same service, one client of another service
  // when close() called, we should only need to close send two 'stop-server' messages
  it('close ThriftClientManager instance', async () => {
    class MockedConnection extends EventEmitter {
      end() {
        this.emit('end');
      }
    }
    const mockedConnection1 = new MockedConnection();
    const mockedConnection2 = new MockedConnection();
    const mockedConnection3 = new MockedConnection();
    jest
      .spyOn(thrift, 'createClient')
      .mockImplementationOnce(() => {})
      .mockImplementationOnce(() => {})
      .mockImplementationOnce(() => {});
    jest
      .spyOn(thrift, 'createConnection')
      .mockImplementationOnce(() => mockedConnection1)
      .mockImplementationOnce(() => mockedConnection2)
      .mockImplementationOnce(() => mockedConnection3);
    mockClientServerCommunication(clientMessage, serverMessage);
    // mock createThriftClient
    getMock(getWrappedThriftClient).mockImplementation(
      (clientId: string, serviceConfig: ThriftServiceConfig, port: number) => {
        const mockedConnection = thrift.createConnection();
        const mockedClient = thrift.createClient();
        return new MockedWrappedThriftClient(
          clientId,
          mockedConnection,
          mockedClient,
        );
      },
    );
    const anotherServiceConfig = {
      name: 'mock-service',
      remoteUri: '',
      remoteCommand: '',
      remoteCommandArgs: [],
      remoteConnection: {
        type: 'tcp',
        port: 0,
      },
      thriftTransport: 'buffered',
      thriftProtocol: 'binary',
      thriftService: {},
      killOldThriftServerProcess: true,
    };
    // monitor calls to server
    const callServer = jest.fn();
    clientMessage.subscribe(callServer);

    // create three clients
    await manager.createThriftClient(mockedServiceConfig);
    await manager.createThriftClient(mockedServiceConfig);
    expect(callServer).toHaveBeenCalledTimes(1);
    await manager.createThriftClient(anotherServiceConfig);
    expect(callServer).toHaveBeenCalledTimes(2);

    // close ThriftClientManager, close all tunnels and clients
    await manager.close();
    await waitsFor(() => callServer.mock.calls.length >= 4);
    expect(callServer).toHaveBeenCalledTimes(4);
  });
});

function mockClientServerCommunication(
  clientMessage: Subject<string>,
  serverMessage: Subject<string>,
): void {
  clientMessage
    .do(message => {
      serverMessage.next(
        encodeMessage({
          id: decodeMessage(message).id,
          payload: {
            type: 'response',
            success: true,
            port: '9000',
          },
        }),
      );
    })
    .subscribe();
}
