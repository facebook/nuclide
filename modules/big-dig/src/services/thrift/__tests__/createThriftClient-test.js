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
import {getWrappedThriftClient} from '../createThriftClient';
import thrift from 'thrift';
import EventEmitter from 'events';

// TODO: Handler unsubscription while connection ended

describe('createThriftClient', () => {
  let mockedClient;
  let mockedConnection;
  let mockServiceConfig;
  let mockPort;

  beforeEach(() => {
    mockServiceConfig = {
      name: 'thrift-mocked',
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
    mockPort = 9000;

    mockedClient = {};
    class MockedConnection extends EventEmitter {
      end = jest.fn(() => this.emit('close'));
    }
    mockedConnection = new MockedConnection();
    jest
      .spyOn(thrift, 'createClient')
      .mockImplementationOnce(() => mockedClient);

    jest
      .spyOn(thrift, 'createConnection')
      .mockImplementationOnce(() => mockedConnection);
  });

  it('cannot get a closed client', () => {
    const client = getWrappedThriftClient(mockServiceConfig, mockPort);
    client.close();
    expect(() => client.getClient()).toThrow('Cannot get a closed client');
  });

  it('successfully initialize a client', () => {
    const client = getWrappedThriftClient(mockServiceConfig, mockPort);
    expect(client.getClient()).toBe(mockedClient);
  });

  it('cannot get a client after connection end', () => {
    const client = getWrappedThriftClient(mockServiceConfig, mockPort);
    mockedConnection.emit('close');
    expect(() => client.getClient()).toThrow(
      'Cannot get a client because connection is closed',
    );
  });

  it('successfully close a client', () => {
    const client = getWrappedThriftClient(mockServiceConfig, mockPort);
    client.close();
    client.close();
    expect(mockedConnection.end).toHaveBeenCalledTimes(1);
  });

  it('fire connection end handler while manually close connection', () => {
    const client = getWrappedThriftClient(mockServiceConfig, mockPort);
    const clientClosedHandler = jest.fn();
    const clientBrokenHandler = jest.fn();
    client.onClientClose(clientClosedHandler);
    client.onUnexpectedClientFailure(clientBrokenHandler);
    client.close();
    client.close();
    expect(clientClosedHandler).toHaveBeenCalledTimes(1);
    expect(clientBrokenHandler).not.toHaveBeenCalled();
  });

  it('fire connection close handler while connection is broken', () => {
    const client = getWrappedThriftClient(mockServiceConfig, mockPort);
    const clientClosedHandler = jest.fn();
    const clientBrokenHandler = jest.fn();
    client.onClientClose(clientClosedHandler);
    client.onUnexpectedClientFailure(clientBrokenHandler);
    mockedConnection.emit('close');
    expect(clientClosedHandler).not.toHaveBeenCalled();
    expect(clientBrokenHandler).toHaveBeenCalledTimes(1);
  });

  it('handle unsubscription to connection end event', () => {
    const client = getWrappedThriftClient(mockServiceConfig, mockPort);
    const fn = jest.fn();
    const subscription = client.onClientClose(fn);
    subscription.unsubscribe();
    client.close();
    expect(fn).not.toHaveBeenCalled();
  });
});
