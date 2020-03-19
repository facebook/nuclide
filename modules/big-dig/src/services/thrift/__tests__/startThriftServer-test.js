/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @emails oncall+nuclide
 * @flow
 * @format
 */

jest.mock(require.resolve('../../../../../nuclide-commons/which'));

import * as processModule from 'nuclide-commons/process';
import {Observable} from 'rxjs';
import which from 'nuclide-commons/which';
import {startThriftServer} from '../startThriftServer';
import net from 'net';

describe('startThriftServer', () => {
  let serverPort;

  beforeEach(() => {
    jest.resetAllMocks();
    (which: any).mockImplementation(cmd => cmd);
  });

  describe('thrift server runs', () => {
    let listener: net.Server;
    let baseConfig;

    beforeAll(async () => {
      await new Promise(resolve => {
        listener = net.createServer(socket => {});
        listener.listen({port: 0}, () => {
          serverPort = listener.address().port;
          baseConfig = {
            name: 'thriftservername',
            remoteCommand: 'test',
            remoteCommandArgs: ['--server-port', String(serverPort)],
            remoteConnection: {
              type: 'tcp',
              port: serverPort,
            },
            killOldThriftServerProcess: true,
          };
          resolve();
        });
      });
    });

    afterAll(async () => {
      await new Promise(resolve => {
        listener.close(resolve);
      });
    });

    it('ignores old thrift server and try to start a new one', async () => {
      // there is one server running
      const oldProcessInfo = {
        parentPid: 0,
        pid: 1,
        command: 'test',
        commandWithArgs: `test --server-port ${serverPort}`,
      };
      jest
        .spyOn(processModule, 'psTree')
        .mockReturnValue(Promise.resolve([oldProcessInfo]));
      // thrift server's messages
      jest
        .spyOn(processModule, 'observeProcess')
        .mockImplementation(command => {
          if (command === 'test') {
            return Observable.empty();
          }
          throw new Error('invalid command');
        });
      const spy = jest
        .spyOn(processModule, 'killPid')
        .mockImplementation(pid => {});

      await startThriftServer({
        ...baseConfig,
        killOldThriftServerProcess: false,
      })
        .refCount()
        .take(1)
        .toPromise();
      expect(spy).not.toBeCalledWith(oldProcessInfo.pid);
    });
  });
});
