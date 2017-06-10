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

import {
  isCorrectConnection,
  isDummyConnection,
  setRootDirectoryUri,
} from '../lib/ConnectionUtils';
import {makeDbgpMessage} from '../lib/helpers';
import {DbgpMessageHandler} from '../lib/DbgpMessageHandler';

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

const payload2 = `<init
  xmlns="urn:debugger_protocol_v1"
  xmlns:xdebug="http://xdebug.org/dbgp/xdebug"
  fileuri="file:///test2.php"
  language="PHP"
  protocol_version="1.0"
  appid="2"
  idekey="username2">

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

const dummyPayload = `<init
  xmlns="urn:debugger_protocol_v1"
  xmlns:xdebug="http://xdebug.org/dbgp/xdebug"
  fileuri="file://foo/scripts/xdebug_includes.php"
  language="PHP"
  protocol_version="1.0"
  appid="2"
  idekey="dummy_user">

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

function convertMessageIntoJson(payload: string): Object {
  return new DbgpMessageHandler().parseMessages(makeDbgpMessage(payload))[0];
}

const xdebugAttachPort = 1234;

const config = {
  xdebugAttachPort,
  pid: 0,
  idekeyRegex: 'username2',
  scriptRegex: 'test2.php',
  endDebugWhenNoRequests: true,
  logLevel: 'info',
  targetUri: 'target_uri',
  phpRuntimePath: '/path/to/binary',
};

describe('debugger-php-rpc ConnectionUtils', () => {
  beforeEach(() => {
    spyOn(require('nuclide-commons/fsPromise').default, 'exists').andReturn(
      true,
    );
    spyOn(require('../lib/config'), 'getConfig').andReturn(config);
  });

  afterEach(() => {
    jasmine.unspy(require('nuclide-commons/fsPromise').default, 'exists');
  });

  describe('isCorrectConnection', () => {
    it('reject', () => {
      const message = convertMessageIntoJson(payload1);
      const result = isCorrectConnection(
        true /* isAttachConnection */,
        message,
      );
      expect(result).toBe(false);
    });

    it('pass', () => {
      const message = convertMessageIntoJson(payload2);
      const result = isCorrectConnection(
        true /* isAttachConnection */,
        message,
      );
      expect(result).toBe(true);
    });
  });

  describe('isDummyConnection', () => {
    beforeEach(() => {
      waitsForPromise(async () => {
        await setRootDirectoryUri('foo');
      });
    });

    it('false', () => {
      waitsForPromise(async () => {
        const message = convertMessageIntoJson(payload1);
        const result = isDummyConnection(message);
        expect(result).toBe(false);
      });
    });

    it('true', () => {
      waitsForPromise(async () => {
        const message = convertMessageIntoJson(dummyPayload);
        const result = isDummyConnection(message);
        expect(result).toBe(true);
      });
    });
  });
});
