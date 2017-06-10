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

import net from 'net';
import {makeDbgpMessage} from '../lib/helpers';
import {DbgpConnector} from '../lib/DbgpConnector';
import EventEmitter from 'events';
import {uncachedRequire, clearRequireCache} from '../../nuclide-test-helpers';

declare class ServerType extends events$EventEmitter {
  close(): void,
  listen(): void,
}

const payload1 = `<init
  xmlns="urn:debugger_protocol_v1"
  xmlns:xdebug="http://xdebug.org/dbgp/xdebug"
  fileuri="file:///test1.php"
  language="PHP"
  protocol_version="1.0"
  appid="1"
  idekey="username1">

  <engine version=""><![CDATA[xdebug]]></engine>
  <author>
    <![CDATA[HHVM]]>
  </author>
  <url>
    <![CDATA[http://hhvm.com/]]>
  </url>
  <copyright>
    <![CDATA[Copyright (c) 2002-2013 by Derick Rethans]]>
  </copyright>
</init>`;

describe('debugger-php-rpc DbgpConnector', () => {
  let server: ServerType = (null: any);
  let socket;

  function createSocketSpy(): EventEmitter {
    const result = new EventEmitter();
    spyOn(result, 'on').andCallThrough();
    spyOn(result, 'once').andCallThrough();
    (result: any).setEncoding = () => {};
    spyOn(result, 'setEncoding').andReturn();
    return result;
  }

  beforeEach(() => {
    const serverEE: any = new EventEmitter();
    spyOn(serverEE, 'on').andCallThrough();
    serverEE.close = jasmine
      .createSpy('close')
      .andCallFake(() => server.emit('close'));
    serverEE.listen = jasmine.createSpy('listen');

    server = (serverEE: ServerType);
    socket = createSocketSpy();

    spyOn(net, 'createServer').andReturn(server);
    uncachedRequire(require, '../lib/DbgpConnector');
  });

  afterEach(() => {
    jasmine.unspy(net, 'createServer');
    clearRequireCache(require, '../lib/DbgpConnector');
  });

  it('connection attach', () => {
    const port = 7779;

    const config = {
      xdebugAttachPort: port,
      logLevel: '',
      targetUri: '',
    };
    spyOn(require('../lib/config'), 'getConfig').andReturn(config);

    const onAttach = jasmine.createSpy('onAttach').andCallFake(params => {
      const attachedSocket = params.socket;
      expect(socket.once).toHaveBeenCalledWith('data', jasmine.any(Function));
      expect(attachedSocket).toBe(socket);

      connector.dispose();
      expect(server.close).toHaveBeenCalledWith();
      expect(onClose).toHaveBeenCalledWith(undefined);
    });
    const onClose = jasmine.createSpy('onClose');

    const connector = new DbgpConnector(port);
    connector.listen();
    connector.onClose(onClose);
    connector.onAttach(onAttach);

    expect(server.on).toHaveBeenCalledWith('close', jasmine.any(Function));
    expect(server.listen).toHaveBeenCalledWith(
      port,
      undefined,
      undefined,
      jasmine.any(Function),
    );
    expect(server.on).toHaveBeenCalledWith('error', jasmine.any(Function));
    expect(server.on).toHaveBeenCalledWith('connection', jasmine.any(Function));
    expect(server.on).toHaveBeenCalledWith('close', jasmine.any(Function));

    const emitted = server.emit('connection', socket);
    expect(emitted).toBe(true);

    expect(onClose).not.toHaveBeenCalledWith();
    expect(onAttach).not.toHaveBeenCalledWith();

    socket.emit('data', makeDbgpMessage(payload1));

    expect(onAttach).toHaveBeenCalled();
  });

  it('abort connection', () => {
    const port = 7781;

    const config = {
      xdebugAttachPort: port,
      logLevel: '',
      targetUri: '',
    };
    spyOn(require('../lib/config'), 'getConfig').andReturn(config);

    const onClose = jasmine.createSpy('onClose');

    const connector = new DbgpConnector(port);
    connector.listen();
    connector.onClose(onClose);

    expect(server.on).toHaveBeenCalledWith('close', jasmine.any(Function));
    expect(server.listen).toHaveBeenCalledWith(
      port,
      undefined,
      undefined,
      jasmine.any(Function),
    );
    expect(server.on).toHaveBeenCalledWith('error', jasmine.any(Function));
    expect(server.on).toHaveBeenCalledWith('connection', jasmine.any(Function));
    expect(server.on).toHaveBeenCalledWith('close', jasmine.any(Function));

    expect(server.close).not.toHaveBeenCalledWith();
    expect(onClose).not.toHaveBeenCalledWith();
    connector.dispose();
    expect(server.close).toHaveBeenCalledWith();
    expect(onClose).toHaveBeenCalledWith(undefined);
  });

  it('connection error - EADDRINUSE', () => {
    const port = 7783;
    const config = {
      xdebugAttachPort: port,
      logLevel: '',
      targetUri: '',
    };
    spyOn(require('../lib/config'), 'getConfig').andReturn(config);

    const onClose = jasmine.createSpy('onClose');
    const onError = jasmine.createSpy('onError');

    const connector = new DbgpConnector(port);
    connector.listen();
    connector.onClose(onClose);
    connector.onError(onError);

    expect(server.on).toHaveBeenCalledWith('close', jasmine.any(Function));
    expect(server.listen).toHaveBeenCalledWith(
      port,
      undefined,
      undefined,
      jasmine.any(Function),
    );
    expect(server.on).toHaveBeenCalledWith('error', jasmine.any(Function));
    expect(server.on).toHaveBeenCalledWith('connection', jasmine.any(Function));
    expect(server.on).toHaveBeenCalledWith('close', jasmine.any(Function));

    expect(server.close).not.toHaveBeenCalledWith();
    expect(onClose).not.toHaveBeenCalledWith();

    // Trigger error.
    const emitted = server.emit('error', {
      code: 'EADDRINUSE',
    });

    expect(emitted).toBe(true);
    expect(onError).toHaveBeenCalledWith(
      `Can't start debugging because port ${port} is being used by another process. ` +
        "Try running 'killall node' on your devserver and then restarting Nuclide.",
    );
    expect(server.close).toHaveBeenCalledWith();
    expect(onClose).toHaveBeenCalledWith(undefined);
  });

  it('connection error - unknown error', () => {
    const port = 7785;
    const config = {
      xdebugAttachPort: port,
      logLevel: '',
      targetUri: '',
    };
    spyOn(require('../lib/config'), 'getConfig').andReturn(config);

    const onClose = jasmine.createSpy('onClose');
    const onError = jasmine.createSpy('onError');

    const connector = new DbgpConnector(port);
    connector.listen();
    connector.onClose(onClose);
    connector.onError(onError);

    expect(server.on).toHaveBeenCalledWith('close', jasmine.any(Function));
    expect(server.listen).toHaveBeenCalledWith(
      port,
      undefined,
      undefined,
      jasmine.any(Function),
    );
    expect(server.on).toHaveBeenCalledWith('error', jasmine.any(Function));
    expect(server.on).toHaveBeenCalledWith('connection', jasmine.any(Function));
    expect(server.on).toHaveBeenCalledWith('close', jasmine.any(Function));

    expect(server.close).not.toHaveBeenCalledWith();
    expect(onClose).not.toHaveBeenCalledWith();

    // Trigger error.
    const errorCode = 'something is wrong';
    const emitted = server.emit('error', {
      code: errorCode,
    });

    expect(emitted).toBe(true);
    expect(onError).toHaveBeenCalledWith(
      `Unknown debugger socket error: ${errorCode}.`,
    );
    expect(server.close).toHaveBeenCalledWith();
    expect(onClose).toHaveBeenCalledWith(undefined);
  });
});
