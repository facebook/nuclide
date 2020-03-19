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
import type {Observable} from 'rxjs';

jest.mock(require.resolve('../createThriftServer'));

import type {ThriftServerConfig} from '../types';

import {Subject} from 'rxjs';
import {getMock} from '../../../../../../jest/jest_mock_utils';
import {ThriftServerManager} from '../ThriftServerManager';
import {createThriftServer} from '../createThriftServer';
import {encodeMessage, decodeMessage} from '../util';

describe('ThriftServerManager', () => {
  let mockedTransport;
  let serverMessage;
  let clientMessage;

  const mockPort = 9000;
  const serverConfig: ThriftServerConfig = {
    name: 'thrift-rfs',
    remoteCommand: '',
    remoteCommandArgs: [],
    remoteConnection: {
      type: 'tcp',
      port: mockPort,
    },
    killOldThriftServerProcess: true,
  };
  const startServerMessage = {
    id: '1',
    payload: {
      type: 'request',
      command: 'start-server',
      serverConfig,
    },
  };
  let mockCloseServerFn;
  let mockGetPortFn;

  beforeEach(() => {
    class MockedTransport {
      onMessage(): Observable<string> {
        // Do not use Observable.of(message) here, which will immediately fire
        // event, use Subject() instead so that we have more controls on it.
        return clientMessage;
      }
      send(message: string): void {
        serverMessage.next(message);
      }
    }

    mockCloseServerFn = jest.fn();
    mockGetPortFn = jest.fn().mockReturnValue({port: mockPort, useIPv4: false});
    getMock(createThriftServer).mockImplementation(() => {
      return {
        getConnectionOptions: mockGetPortFn,
        close: mockCloseServerFn,
      };
    });

    serverMessage = new Subject();
    clientMessage = new Subject();
    mockedTransport = new MockedTransport();
    // eslint-disable-next-line no-new
    new ThriftServerManager(mockedTransport);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('successfully start server', async () => {
    const expectedResponse = {
      id: '1',
      payload: {
        type: 'response',
        success: true,
        connectionOptions: {
          port: mockPort,
          useIPv4: false,
        },
      },
    };
    const responsePromise = serverMessage.take(1).toPromise();
    clientMessage.next(encodeMessage(startServerMessage));
    const response = decodeMessage(await responsePromise);
    expect(response).toEqual(expectedResponse);
  });

  it('responses fail for malformatted message', async () => {
    const malformattedMessage = {
      id: '1',
    };
    const expectedResponse = {
      id: '1',
      payload: {
        type: 'response',
        success: false,
        error: 'Malformatted request message!',
      },
    };
    const responsePromise = serverMessage.take(1).toPromise();
    clientMessage.next(JSON.stringify(malformattedMessage));
    const response = decodeMessage(await responsePromise);
    expect(response).toEqual(expectedResponse);
  });

  it('responses fail for malformatted message payload', async () => {
    const malformattedMessage = {
      id: '1',
      payload: {type: 'request'},
    };
    const expectedResponse = {
      id: '1',
      payload: {
        type: 'response',
        success: false,
        error: 'Malformatted request message!',
      },
    };
    const responsePromise = serverMessage.take(1).toPromise();
    clientMessage.next(JSON.stringify(malformattedMessage));
    const response = decodeMessage(await responsePromise);
    expect(response).toEqual(expectedResponse);
  });

  it('responses fail when server failed to start', async () => {
    const expectedResponse = {
      id: '1',
      payload: {
        type: 'response',
        success: false,
        error: 'Failed to create server',
      },
    };
    getMock(createThriftServer).mockImplementation(() => {
      throw new Error('mocked error');
    });
    const responsePromise = serverMessage.take(1).toPromise();
    clientMessage.next(encodeMessage(startServerMessage));
    const response = decodeMessage(await responsePromise);
    expect(response).toEqual(expectedResponse);
  });

  it('successfully close server', async () => {
    const closeServerMessage = {
      id: '2',
      payload: {
        type: 'request',
        command: 'stop-server',
        serverConfig,
      },
    };
    const expectedResponse = {
      id: '2',
      payload: {
        type: 'response',
        success: true,
      },
    };

    const firstResponsePromise = serverMessage.take(1).toPromise();
    clientMessage.next(encodeMessage(startServerMessage));
    await firstResponsePromise;
    const secondResponsePromise = serverMessage.take(1).toPromise();
    clientMessage.next(encodeMessage(closeServerMessage));
    const response = decodeMessage(await secondResponsePromise);
    expect(response).toEqual(expectedResponse);
    expect(mockCloseServerFn).toHaveBeenCalled();
  });

  it('reuse existing server', async () => {
    const firstStartServerMessage = {
      id: '1',
      payload: {
        type: 'request',
        command: 'start-server',
        serverConfig,
      },
    };
    const firstResponsePromise = serverMessage.take(1).toPromise();
    clientMessage.next(encodeMessage(firstStartServerMessage));
    await firstResponsePromise;

    const secondStartServerMessage = {
      id: '2',
      payload: {
        type: 'request',
        command: 'start-server',
        serverConfig,
      },
    };
    const expectedSecondResponse = {
      id: '2',
      payload: {
        type: 'response',
        success: true,
        connectionOptions: {port: mockPort, useIPv4: false},
      },
    };
    const secondResponsePromise = serverMessage.take(1).toPromise();
    clientMessage.next(encodeMessage(secondStartServerMessage));
    const secondResponse = decodeMessage(await secondResponsePromise);
    expect(secondResponse).toEqual(expectedSecondResponse);
    expect(createThriftServer).toHaveBeenCalledTimes(1);

    const firstStopServerMessage = {
      id: '3',
      payload: {
        type: 'request',
        command: 'stop-server',
        serverConfig,
      },
    };
    const expectedThirdResponse = {
      id: '3',
      payload: {
        type: 'response',
        success: true,
      },
    };
    const thirdResponsePromise = serverMessage.take(1).toPromise();
    clientMessage.next(encodeMessage(firstStopServerMessage));
    const thirdResponse = decodeMessage(await thirdResponsePromise);
    expect(thirdResponse).toEqual(expectedThirdResponse);
    expect(mockCloseServerFn).not.toHaveBeenCalled();

    const secondStopServerMessage = {
      id: '4',
      payload: {
        type: 'request',
        command: 'stop-server',
        serverConfig,
      },
    };
    const expectedFourthResponse = {
      id: '4',
      payload: {
        type: 'response',
        success: true,
      },
    };
    const fourthResponsePromise = serverMessage.take(1).toPromise();
    clientMessage.next(encodeMessage(secondStopServerMessage));
    const fourthResponse = decodeMessage(await fourthResponsePromise);
    expect(fourthResponse).toEqual(expectedFourthResponse);
    expect(mockCloseServerFn).toHaveBeenCalled();
  });
});
