/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
jest.mock('../../src/client/utils/asyncRequest');
jest.useFakeTimers();

import asyncRequest from '../../src/client/utils/asyncRequest';
import {XhrConnectionHeartbeat} from '../../src/client/XhrConnectionHeartbeat';
import * as asyncRequestModule from '../../src/client/utils/asyncRequest';

const mockAsyncRequest = jest.spyOn(asyncRequestModule, 'default');
const serverUri = 'testserveruri';
const heartbeatChannel = 'testheartbeatChannel';
const options = {};
// Same as in XhrConnectionHeartbeat
const HEARTBEAT_INTERVAL_MS = 10000;

class MyError extends Error {
  code: string;
}

const err = new MyError('Connection Error');
err.code = 'ECONNRESET';

describe('Check Connection Error Code', () => {
  test('Test mock asyncRequest behavior', () => {
    mockAsyncRequest.mockReturnValueOnce(Promise.reject(err));
    expect.assertions(1);
    return asyncRequest({uri: 'http://127.0.0.1:36845/testendpoint'}).catch(
      error => {
        expect(error.code).toBe('ECONNRESET');
      },
    );
  });

  test('Test heartbeat class _checkReconnectErrorType function', async () => {
    mockAsyncRequest
      .mockReturnValueOnce(Promise.reject(err)) // ECONNRESET
      .mockReturnValueOnce(Promise.reject(err)) // ECONNRESET
      .mockReturnValueOnce(Promise.reject(err)) // ECONNRESET
      .mockReturnValueOnce(Promise.resolve('Good')) // Good connection
      .mockReturnValueOnce(Promise.reject(err)) // ECONNRESET
      .mockReturnValueOnce(Promise.reject(err)) // ECONNRESET
      .mockReturnValueOnce(Promise.reject(err)) // ECONNRESET
      .mockReturnValueOnce(Promise.reject(err)); // INVALID_CERTIFICATE

    const heartbeat = new XhrConnectionHeartbeat(
      serverUri,
      heartbeatChannel,
      options,
    );

    expect(heartbeat._connectionResetCount).toBe(0);

    // In XhrConnectionHeartbeat constructor _monitorServerHeartbeat will call
    // _heartbeat() once, cause one heartbeat error
    jest.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
    const error1 = await new Promise(resolve => {
      heartbeat.onHeartbeatError(resolve);
    });
    expect(error1.code).toBe('ECONNRESET');
    expect(heartbeat._connectionResetCount).toBe(2);

    jest.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
    const error2 = await new Promise(resolve => {
      heartbeat.onHeartbeatError(resolve);
    });
    expect(error2.code).toBe('ECONNRESET');
    expect(heartbeat._connectionResetCount).toBe(3);

    // Will reset _connectionResetCount after one successful heartbeat request
    // Fast forward two HEARTBEAT_INTERVAL_MS to check next heartbeat error
    jest.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 2);
    const error3 = await new Promise(resolve => {
      heartbeat.onHeartbeatError(resolve);
    });
    expect(error3.code).toBe('ECONNRESET');
    expect(heartbeat._connectionResetCount).toBe(1);

    jest.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
    const error4 = await new Promise(resolve => {
      heartbeat.onHeartbeatError(resolve);
    });
    expect(error4.code).toBe('ECONNRESET');
    expect(heartbeat._connectionResetCount).toBe(2);

    jest.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
    const error5 = await new Promise(resolve => {
      heartbeat.onHeartbeatError(resolve);
    });
    expect(error5.code).toBe('ECONNRESET');
    expect(heartbeat._connectionResetCount).toBe(3);

    jest.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
    const error6 = await new Promise(resolve => {
      heartbeat.onHeartbeatError(resolve);
    });
    expect(error6.code).toBe('INVALID_CERTIFICATE');
    expect(heartbeat._connectionResetCount).toBe(0);
  });
});
