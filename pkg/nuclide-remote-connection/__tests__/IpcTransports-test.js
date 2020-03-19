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
import {fork} from 'nuclide-commons/process';
import {IpcClientTransport} from '../lib/IpcTransports';
import waitsFor from '../../../jest/waits_for';

describe('IpcTransports', () => {
  let processStream;
  beforeEach(() => {
    processStream = fork(
      '--require',
      [
        require.resolve('../../commons-node/load-transpiler'),
        require.resolve('../__mocks__/ipc_echo_process'),
      ],
      {
        stdio: ['pipe', 'pipe', 'pipe', 'pipe', 'ipc'],
      },
    );
  });

  it('is able to communicate with a child process', async () => {
    const transport = new IpcClientTransport(processStream);
    const messageSpy = jest.fn();
    transport.onMessage().subscribe(msg => messageSpy(msg));

    expect(!transport.isClosed());
    transport.send('hello');

    await waitsFor(
      () => messageSpy.mock.calls.length === 1,
      'a reply from the local server',
      10000,
    );

    expect(messageSpy).toHaveBeenCalledWith('HELLO');
    transport.send('a'.repeat(99999));

    await waitsFor(
      () => messageSpy.mock.calls.length === 2,
      'another reply from the local server',
      10000,
    );

    expect(messageSpy).toHaveBeenCalledWith('A'.repeat(99999));
    transport.send('exit');

    await waitsFor(() => transport.isClosed());
  });
});
