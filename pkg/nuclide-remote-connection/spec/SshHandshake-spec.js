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

import type {SshConnectionConfiguration} from '../lib/SshHandshake';

import EventEmitter from 'events';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {clearRequireCache, uncachedRequire} from 'nuclide-commons/test-helpers';
import {SshHandshake} from '../lib/SshHandshake';
import type {ExecOptions, SFTPWrapper, ClientChannel} from 'ssh2';

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
    spyOn(
      ((dns: any): Object),
      'lookup',
    ).andCallFake((host, family, callback) => {
      process.nextTick(() => {
        callback(/* error */ null, /* address */ 'example.com', /* family */ 4);
      });
    });
    handshakeDelegate = jasmine.createSpyObj('delegate', [
      'onKeyboardInteractive',
      'onWillConnect',
      'onDidConnect',
      'onError',
    ]);
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

      expect(handshakeDelegate.onWillConnect.callCount).toBe(1);
      expect(handshakeDelegate.onError.callCount).toBe(1);
      expect(handshakeDelegate.onError.calls[0].args[0]).toBe(
        SshHandshake.ErrorType.UNKNOWN,
      );
      expect(handshakeDelegate.onError.calls[0].args[1]).toBe(mockError);
      expect(handshakeDelegate.onError.calls[0].args[2]).toBe(config);
    });

    it('calls delegates onError when private key does not exist', () => {
      const sshConnection: any = new MockSshConnection();
      const sshHandshake = new SshHandshake(handshakeDelegate, sshConnection);
      const config: SshConnectionConfiguration = ({
        pathToPrivateKey: pathToFakePk + '.oops',
        authMethod: 'PRIVATE_KEY',
      }: any);

      sshHandshake.connect(config);

      let onErrorCalled = false;

      handshakeDelegate.onError.andCallFake((errorType, e, _config) => {
        expect(errorType).toBe(SshHandshake.ErrorType.CANT_READ_PRIVATE_KEY);
        expect(e.code).toBe('ENOENT');
        expect(_config).toBe(config);
        onErrorCalled = true;
      });

      waitsFor(() => {
        return onErrorCalled;
      });

      runs(() => {
        expect(handshakeDelegate.onError.callCount).toBe(1);
      });
    });

    it('retries with a password when authentication fails', () => {
      const mockError = new Error();
      (mockError: any).level = 'client-authentication';
      const sshConnection: any = new MockSshConnection();
      const sshHandshake = new SshHandshake(handshakeDelegate, sshConnection);
      const config: SshConnectionConfiguration = ({
        password: 'test',
        authMethod: 'PASSWORD',
      }: any);

      sshHandshake.connect(config);
      sshConnection.emit('error', mockError);

      expect(handshakeDelegate.onWillConnect.callCount).toBe(1);
      expect(handshakeDelegate.onKeyboardInteractive.callCount).toBe(1);
      let args = handshakeDelegate.onKeyboardInteractive.calls[0].args;
      expect(args[3][0].prompt).toContain('password');

      // Trigger the input callback.
      spyOn(sshConnection, 'connect');
      args[4](['test2']);

      expect(sshConnection.connect.callCount).toBe(1);
      expect(sshConnection.connect.calls[0].args[0].password).toBe('test2');

      sshConnection.emit('error', mockError);
      expect(handshakeDelegate.onKeyboardInteractive.callCount).toBe(2);
      args = handshakeDelegate.onKeyboardInteractive.calls[1].args;

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

      spyOn(sshConnection, 'end');

      sshHandshake.connect(config);
      sshHandshake.cancel();

      expect(sshConnection.end.calls.length).toBe(1);
    });
  });
});
