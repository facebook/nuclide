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

import type {Socket} from 'net';

import {makeMessage} from '../lib/helpers';
import {
  DbgpSocket,
  COMMAND_STEP_OVER,
  ConnectionStatus,
  COMMAND_RUN,
} from '../lib/DbgpSocket';
import {
  idOfFrame,
  functionOfFrame,
  fileOfFrame,
  locationOfFrame,
} from '../lib/frame';

describe('debugger-php-rpc DbgpSocket', () => {
  let socket: Socket = (null: any);
  let dbgpSocket;
  let onData;
  let onEnd;
  let onError;
  let onStatus;

  beforeEach(() => {
    socket = ((jasmine.createSpyObj('socket', [
      'write',
      'end',
      'destroy',
      'on',
    ]): any): Socket);
    onStatus = jasmine.createSpy('onStatus');
    // $FlowFixMe override instance method.
    socket.on = (event, callback) => {
      switch (event) {
        case 'data':
          onData = callback;
          break;
        case 'error':
          onError = callback;
          break;
        case 'end':
          onEnd = callback;
          break;
      }
    };
    spyOn(socket, 'on').andCallThrough();
    dbgpSocket = new DbgpSocket(socket);
    dbgpSocket.onStatus(onStatus);
  });

  function testSocketWrite(socketWrite: string): void {
    expect(socket.write).toHaveBeenCalledWith(socketWrite + '\x00');
  }

  function testCallResult(socketWrite, onDataObject, body): void {
    testSocketWrite(socketWrite);
    onData(makeMessage(onDataObject, body));
  }

  async function testCall(
    resultPromise,
    socketWrite,
    onDataObject,
    expectedResult,
    body,
  ) {
    testCallResult(socketWrite, onDataObject, body);
    const result = await resultPromise;
    expect(result).toBe(expectedResult);
  }

  it('constructor', () => {
    expect(socket.on).toHaveBeenCalledWith('end', jasmine.any(Function));
    expect(socket.on).toHaveBeenCalledWith('error', jasmine.any(Function));
    expect(socket.on).toHaveBeenCalledWith('data', jasmine.any(Function));
  });

  it('dispose', () => {
    dbgpSocket.dispose();
    expect(socket.end).toHaveBeenCalled();
    expect(socket.destroy).toHaveBeenCalled();
  });

  it('error', () => {
    onError({code: 42});
    expect(onStatus).toHaveBeenCalledWith(ConnectionStatus.Error, 42);
  });

  it('end', () => {
    onEnd();
    expect(onStatus).toHaveBeenCalledWith(ConnectionStatus.End);
  });

  it('getStatus', () => {
    waitsForPromise(() => {
      return testCall(
        dbgpSocket.getStatus(),
        'status -i 1',
        {
          status: 'stopping',
          reason: 'ok',
          command: 'status',
          transaction_id: '1',
        },
        'stopping',
      );
    });
  });

  it('sendContinuationCommand - break', () => {
    waitsForPromise(async () => {
      expect(dbgpSocket._lastContinuationCommandTransactionId).toBe(null);
      const resultPromise = dbgpSocket.sendContinuationCommand(
        COMMAND_STEP_OVER,
      );
      expect(onStatus).toHaveBeenCalledWith(ConnectionStatus.Running);
      expect(dbgpSocket._lastContinuationCommandTransactionId).toBe(1);
      await testCall(
        resultPromise,
        'step_over -i 1',
        {
          status: 'break',
          reason: 'ok',
          command: 'step_over',
          transaction_id: '1',
        },
        ConnectionStatus.Break,
      );
      expect(onStatus).toHaveBeenCalledWith(ConnectionStatus.Break);
      expect(dbgpSocket._lastContinuationCommandTransactionId).toBe(null);
    });
  });

  it('sendContinuationCommand - stopping', () => {
    waitsForPromise(async () => {
      expect(dbgpSocket._lastContinuationCommandTransactionId).toBe(null);
      const resultPromise = dbgpSocket.sendContinuationCommand(
        COMMAND_STEP_OVER,
      );
      expect(onStatus).toHaveBeenCalledWith(ConnectionStatus.Running);
      expect(dbgpSocket._lastContinuationCommandTransactionId).toBe(1);
      await testCall(
        resultPromise,
        'step_over -i 1',
        {
          status: 'stopping',
          reason: 'ok',
          command: 'step_over',
          transaction_id: '1',
        },
        ConnectionStatus.Stopping,
      );
      expect(onStatus).toHaveBeenCalledWith(ConnectionStatus.Stopping);
      expect(dbgpSocket._lastContinuationCommandTransactionId).toBe(null);
    });
  });

  it('sendBreakCommand', () => {
    waitsForPromise(async () => {
      await testCall(
        dbgpSocket.sendBreakCommand(),
        'break -i 1',
        {
          success: '1',
          command: 'break',
          transaction_id: '1',
        },
        true,
      );
      await testCall(
        dbgpSocket.sendBreakCommand(),
        'break -i 2',
        {
          success: '0',
          command: 'break',
          transaction_id: '2',
        },
        false,
      );
    });
  });

  it('runtimeEvaluate - continuation from eval with break', () => {
    waitsForPromise(async () => {
      expect(dbgpSocket._pendingEvalTransactionIds.size).toBe(0);
      dbgpSocket.runtimeEvaluate('foo()');
      testCallResult('eval -i 1 -- Zm9vKCk=', {
        status: 'break',
        command: 'eval',
        transaction_id: '1',
      });
      expect([...dbgpSocket._pendingEvalTransactionIds][0]).toBe(1);
      dbgpSocket.sendContinuationCommand(COMMAND_RUN);
      expect(onStatus).toHaveBeenCalledWith(ConnectionStatus.Running);
      await testCallResult('run -i 2', {
        command: 'eval',
        transaction_id: '1',
      });
      expect(dbgpSocket._lastContinuationCommandTransactionId).toBe(null);
      expect(dbgpSocket._pendingEvalTransactionIds.size).toBe(0);
    });
  });

  it('getStackFrames', () => {
    waitsForPromise(async () => {
      const call = dbgpSocket.getStackFrames();
      testCallResult(
        'stack_get -i 1',
        {
          command: 'stack_get',
          transaction_id: '1',
        },
        '<stack where="foo" level="0" type="file" filename="file:///home/peterhal/test/dbgp/test-client.php" lineno="4"></stack>' +
          '<stack where="{main}" level="1" type="file" filename="file:///home/peterhal/test/dbgp/test-client.php" lineno="10"></stack>',
      );
      const result = await call;

      const stack = result.stack;
      expect(stack.length).toBe(2);

      const frame0 = stack[0];
      expect(idOfFrame(frame0)).toBe('0');
      expect(functionOfFrame(frame0)).toBe('foo');
      expect(fileOfFrame(frame0)).toBe(
        '/home/peterhal/test/dbgp/test-client.php',
      );
      expect(locationOfFrame(frame0)).toEqual({
        lineNumber: 3,
        scriptId: fileOfFrame(frame0),
      });

      const frame1 = stack[1];
      expect(idOfFrame(frame1)).toBe('1');
      expect(functionOfFrame(frame1)).toBe('{main}');
      expect(fileOfFrame(frame1)).toBe(
        '/home/peterhal/test/dbgp/test-client.php',
      );
      expect(locationOfFrame(frame1)).toEqual({
        lineNumber: 9,
        scriptId: fileOfFrame(frame1),
      });
    });
  });

  it('setExceptionBreakpoint', () => {
    waitsForPromise(async () => {
      const call = dbgpSocket.setExceptionBreakpoint('exception_name');
      testCallResult('breakpoint_set -i 1 -t exception -x exception_name', {
        command: 'breakpoint_set',
        transaction_id: '1',
        state: 'enabled',
        id: '10',
      });
      const result = await call;
      expect(result).toBe('10');
    });
  });

  it('setBreakpoint', () => {
    waitsForPromise(async () => {
      const call = dbgpSocket.setFileLineBreakpoint({
        filename: '/test.php',
        lineNumber: 42,
        conditionExpression: null,
      });
      testCallResult('breakpoint_set -i 1 -t line -f /test.php -n 42', {
        command: 'breakpoint_set',
        transaction_id: '1',
        state: 'enabled',
        id: '12',
      });
      const result = await call;
      expect(result).toBe('12');
    });
  });

  it('setBreakpoint - error', () => {
    const call = dbgpSocket.setFileLineBreakpoint({
      filename: '/test.php',
      lineNumber: 42,
      conditionExpression: null,
    });
    testCallResult(
      'breakpoint_set -i 1 -t line -f /test.php -n 42',
      {
        command: 'breakpoint_set',
        transaction_id: '1',
      },
      '<error code="1" apperr="42"><message>setBreakpoint error</message></error>',
    );
    waitsForPromise({shouldReject: true}, async () => call);
  });

  it('removeBreakpoint', () => {
    waitsForPromise(async () => {
      const call = dbgpSocket.removeBreakpoint('42');
      testCallResult('breakpoint_remove -i 1 -d 42', {
        command: 'breakpoint_remove',
        transaction_id: '1',
      });
      const result = await call;
      expect(result).toBe(undefined);
    });
  });

  it('removeBreakpoint - error', () => {
    const call = dbgpSocket.removeBreakpoint('42');
    testCallResult(
      'breakpoint_remove -i 1 -d 42',
      {
        command: 'breakpoint_remove',
        transaction_id: '1',
      },
      '<error code="1" apperr="42"><message>removeBreakpoint error</message></error>',
    );
    waitsForPromise({shouldReject: true}, async () => call);
  });

  it('getContextsForFrame', () => {
    waitsForPromise(async () => {
      const call = dbgpSocket.getContextsForFrame(42);
      testCallResult(
        'context_names -i 1 -d 42',
        {
          command: 'context_names',
          transaction_id: '1',
        },
        '<context name="Local" id="0"/>' +
          '<context name="Global" id="1"/>' +
          '<context name="Class" id="2"/>',
      );
      const result = await call;
      expect(result).toEqual([
        {
          name: 'Local',
          id: '0',
        },
        {
          name: 'Global',
          id: '1',
        },
        {
          name: 'Class',
          id: '2',
        },
      ]);
    });
  });

  it('getContextProperties', () => {
    waitsForPromise(async () => {
      const call = dbgpSocket.getContextProperties(43, '42');
      testCallResult(
        'context_get -i 1 -d 43 -c 42',
        {
          command: 'context_get',
          transaction_id: '1',
        },
        '<property>the-result</property>',
      );
      const result = await call;
      expect(result).toEqual(['the-result']);
    });
  });

  it('getPropertiesByFullname', () => {
    waitsForPromise(async () => {
      const call = dbgpSocket.getPropertiesByFullname(
        43,
        '42',
        'fullname-value',
        45,
      );
      testCallResult(
        'property_value -i 1 -d 43 -c 42 -n "fullname-value" -p 45',
        {
          command: 'property_value',
          transaction_id: '1',
        },
        '<property><property>the-result</property></property>',
      );
      const result = await call;
      expect(result).toEqual(['the-result']);
    });
  });

  it('mulitple messages', () => {
    waitsForPromise(async () => {
      const call1 = dbgpSocket.getContextsForFrame(0);
      const call2 = dbgpSocket.getContextsForFrame(1);

      testSocketWrite('context_names -i 1 -d 0');
      testSocketWrite('context_names -i 2 -d 1');

      const message1 = makeMessage(
        {
          command: 'context_names',
          transaction_id: '1',
        },
        '<context name="Local" id="0"/>' +
          '<context name="Global" id="1"/>' +
          '<context name="Class" id="2"/>',
      );
      const message2 = makeMessage(
        {
          command: 'context_names',
          transaction_id: '2',
        },
        '<context name="Local2" id="0"/>' +
          '<context name="Global2" id="1"/>' +
          '<context name="Class2" id="2"/>',
      );

      onData(message1 + message2);

      const result1 = await call1;
      expect(result1).toEqual([
        {
          name: 'Local',
          id: '0',
        },
        {
          name: 'Global',
          id: '1',
        },
        {
          name: 'Class',
          id: '2',
        },
      ]);

      const result2 = await call2;
      expect(result2).toEqual([
        {
          name: 'Local2',
          id: '0',
        },
        {
          name: 'Global2',
          id: '1',
        },
        {
          name: 'Class2',
          id: '2',
        },
      ]);
    });
  });
});
