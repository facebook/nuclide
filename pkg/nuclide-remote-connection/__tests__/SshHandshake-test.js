/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */
import type {SshConnectionConfiguration} from '../lib/SshHandshake';

import EventEmitter from 'events';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {clearRequireCache, uncachedRequire} from 'nuclide-commons/test-helpers';
import {SshHandshake} from '../lib/SshHandshake';
import type {ExecOptions, SFTPWrapper, ClientChannel} from 'ssh2';
import waitsFor from '../../../jest/waits_for';

const pathToFakePk = nuclideUri.join(__dirname, 'fakepk');

describe('SshHandshake', () => {
  class MockSshConnection extends EventEmitter {
    connect(config) {}
    end() {}
    exec(
      command: string,
      options?: ExecOptions,
      callback: (err: Error, channel: ClientChannel) => void | Promise<void>,
    ): boolean {
      return false;
    }

    sftp(
      callback: (err: Error, sftp: SFTPWrapper) => void | Promise<void>,
    ): boolean {
      return false;
    }

    forwardOut(
      srcIP: string,
      srcPort: number,
      dstIP: string,
      dstPort: number,
      callback: (err: Error, channel: ClientChannel) => void | Promise<void>,
    ): boolean {
      return false;
    }
  }

  let dns;
  let handshakeDelegate: any;

  beforeEach(() => {
    dns = uncachedRequire(require, 'dns');
    jest
      .spyOn(((dns: any): Object), 'lookup')
      .mockImplementation((host, family, callback) => {
        process.nextTick(() => {
          callback(
            /* error */ null,
            /* address */ 'example.com',
            /* family */ 4,
          );
        });
      });
    handshakeDelegate = {
      onKeyboardInteractive: jest.fn(),
      onWillConnect: jest.fn(),
      onDidConnect: jest.fn(),
      onError: jest.fn(),
    };
  });

  afterEach(() => {
    clearRequireCache(require, 'dns');
  });

  describe('connect()', () => {
    it('calls delegates onError when ssh connection fails', () => {
      const mockError = new Error('mock error');
      const sshConnection: any = new MockSshConnection();
      const sshHandshake = new SshHandshake(handshakeDelegate, sshConnection);
      const config: SshConnectionConfiguration = ({
        pathToPrivateKey: pathToFakePk,
        authMethod: 'PRIVATE_KEY',
      }: any);

      sshHandshake.connect(config);
      sshConnection.emit('error', mockError);

      expect(handshakeDelegate.onWillConnect.mock.calls.length).toBe(1);
      expect(handshakeDelegate.onError.mock.calls.length).toBe(1);
      expect(handshakeDelegate.onError.mock.calls[0][0]).toBe(
        SshHandshake.ErrorType.UNKNOWN,
      );
      expect(handshakeDelegate.onError.mock.calls[0][1]).toBe(mockError);
      expect(handshakeDelegate.onError.mock.calls[0][2]).toBe(config);
    });

    it('calls delegates onError when private key does not exist', async () => {
      const sshConnection: any = new MockSshConnection();
      const sshHandshake = new SshHandshake(handshakeDelegate, sshConnection);
      const config: SshConnectionConfiguration = ({
        pathToPrivateKey: pathToFakePk + '.oops',
        authMethod: 'PRIVATE_KEY',
      }: any);

      sshHandshake.connect(config);

      let onErrorCalled = false;

      handshakeDelegate.onError.mockImplementation((errorType, e, _config) => {
        expect(errorType).toBe(SshHandshake.ErrorType.CANT_READ_PRIVATE_KEY);
        expect(e.code).toBe('ENOENT');
        expect(_config).toBe(config);
        onErrorCalled = true;
      });

      await waitsFor(() => {
        return onErrorCalled;
      });

      expect(handshakeDelegate.onError.mock.calls.length).toBe(1);
    });

    it('retries with a password when authentication fails', () => {
      const mockError = new Error();
      (mockError: any).level = 'client-authentication';
      const sshConnection: any = new MockSshConnection();
      const sshHandshake = new SshHandshake(handshakeDelegate, sshConnection);
      const config: SshConnectionConfiguration = ({
        host: 'testhost',
        password: 'test',
        authMethod: 'PASSWORD',
      }: any);

      sshHandshake.connect(config);
      sshConnection.config = config;
      sshConnection.emit('error', mockError);

      expect(handshakeDelegate.onWillConnect.mock.calls.length).toBe(1);
      expect(handshakeDelegate.onKeyboardInteractive.mock.calls.length).toBe(1);
      let args = handshakeDelegate.onKeyboardInteractive.mock.calls[0];
      expect(args[3][0].prompt).toContain('password');

      // Trigger the input callback.
      jest.spyOn(sshConnection, 'connect').mockImplementation(() => {});
      args[4](['test2']);

      expect(sshConnection.connect.mock.calls.length).toBe(1);
      expect(sshConnection.connect.mock.calls[0][0].host).toBe('testhost');
      expect(sshConnection.connect.mock.calls[0][0].password).toBe('test2');

      sshConnection.emit('error', mockError);
      expect(handshakeDelegate.onKeyboardInteractive.mock.calls.length).toBe(2);
      args = handshakeDelegate.onKeyboardInteractive.mock.calls[1];

      sshHandshake.cancel();
    });
  });

  describe('cancel()', () => {
    it('calls SshConnection.end()', () => {
      const sshConnection: any = new MockSshConnection();
      const sshHandshake = new SshHandshake(handshakeDelegate, sshConnection);
      const config: SshConnectionConfiguration = ({
        pathToPrivateKey: pathToFakePk,
      }: any);

      jest.spyOn(sshConnection, 'end').mockImplementation(() => {});

      sshHandshake.connect(config);
      sshHandshake.cancel();

      expect(sshConnection.end.mock.calls.length).toBe(1);
    });
  });
});
