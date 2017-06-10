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

import type {ClientCallback as ClientCallbackType} from '../lib/ClientCallback';
import type {
  ConnectionMultiplexer as ConnectionMultiplexerType,
} from '../lib/ConnectionMultiplexer';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {ConnectionMultiplexerStatus} from '../lib/ConnectionMultiplexer';
import {DebuggerHandler} from '../lib/DebuggerHandler';

describe('debugger-php-rpc DebuggerHandler', () => {
  let clientCallback: any;
  let connectionMultiplexer: any;
  let handler: any;
  let onStatus: any;
  let onStatusSubscription: any;
  let observableSpy: any;

  beforeEach(() => {
    observableSpy = jasmine.createSpyObj('serverMessageObservable', [
      'onNext',
      'onCompleted',
    ]);
    clientCallback = ((jasmine.createSpyObj('clientCallback', [
      'replyToCommand',
      'replyWithError',
      'sendServerMethod',
      'getServerMessageObservable',
    ]): any): ClientCallbackType);
    // $FlowIssue -- instance method on object.
    clientCallback.getServerMessageObservable = jasmine
      .createSpy('getServerMessageObservable')
      .andReturn(observableSpy);
    connectionMultiplexer = ((jasmine.createSpyObj('connectionMultiplexer', [
      'onStatus',
      'onNotification',
      'listen',
      'getStatus',
      'getConnectionStackFrames',
      'sendContinuationCommand',
      'getScopesForFrame',
      'getRequestSwitchMessage',
      'getEnabledConnectionId',
      'resetRequestSwitchMessage',
      'pause',
      'resume',
      'dispose',
    ]): any): ConnectionMultiplexerType);
    onStatusSubscription = jasmine.createSpyObj('onStatusSubscription', [
      'dispose',
    ]);
    const onNotificationSubscription = jasmine.createSpyObj(
      'onNotificationSubscription',
      ['dispose'],
    );
    // $FlowFixMe override instance methods.
    connectionMultiplexer.onStatus = jasmine
      .createSpy('onStatus')
      .andCallFake(callback => {
        onStatus = callback;
        return onStatusSubscription;
      });
    // $FlowFixMe override instance methods.
    connectionMultiplexer.listen = jasmine
      .createSpy('listen')
      .andCallFake(callback => {
        return new UniversalDisposable();
      });
    // $FlowFixMe
    connectionMultiplexer.onNotification = jasmine
      .createSpy('onNotification')
      .andReturn(onNotificationSubscription);
    handler = new DebuggerHandler(clientCallback, connectionMultiplexer);
  });

  it('enable', () => {
    waitsForPromise(async () => {
      await handler.handleMethod(1, 'enable');
      expect(clientCallback.replyToCommand).toHaveBeenCalledWith(
        1,
        {},
        undefined,
      );
      expect(connectionMultiplexer.listen).not.toHaveBeenCalledWith();
      expect(
        clientCallback.sendServerMethod,
      ).toHaveBeenCalledWith('Debugger.paused', {
        callFrames: [],
        reason: 'initial break',
        data: {},
      });
    });
  });

  it('stack', () => {
    waitsForPromise(async () => {
      connectionMultiplexer.getEnabledConnectionId = jasmine
        .createSpy('getEnabledConnectionId')
        .andReturn(1);
      connectionMultiplexer.getConnectionStopReason = jasmine
        .createSpy('getConnectionStopReason')
        .andReturn('breakpoint');
      connectionMultiplexer.getConnectionStackFrames = jasmine
        .createSpy('getConnectionStackFrames')
        .andReturn(
          Promise.resolve({
            stack: [
              {
                $: {
                  where: 'foo',
                  level: '0',
                  type: 'file',
                  filename: 'file:///usr/test.php',
                  lineno: '5',
                },
              },
              {
                $: {
                  where: 'main',
                  level: '1',
                  type: 'file',
                  filename: 'file:///usr/test.php',
                  lineno: '15',
                },
              },
            ],
          }),
        );

      await onStatus(ConnectionMultiplexerStatus.SingleConnectionPaused);

      expect(
        connectionMultiplexer.getConnectionStackFrames,
      ).toHaveBeenCalledWith(1);
      expect(connectionMultiplexer.getScopesForFrame).toHaveBeenCalledWith(0);
      expect(connectionMultiplexer.getScopesForFrame).toHaveBeenCalledWith(1);
      expect(
        clientCallback.sendServerMethod,
      ).toHaveBeenCalledWith('Debugger.scriptParsed', {
        scriptId: '/usr/test.php',
        url: 'file:///usr/test.php',
        startLine: 0,
        startColumn: 0,
        endLine: 0,
        endColumn: 0,
      });
      expect(
        clientCallback.sendServerMethod,
      ).toHaveBeenCalledWith('Debugger.paused', {
        callFrames: [
          {
            callFrameId: '0',
            functionName: 'foo',
            location: {
              lineNumber: 4,
              scriptId: '',
            },
            scopeChain: undefined,
          },
          {
            callFrameId: '1',
            functionName: 'main',
            location: {
              lineNumber: 14,
              scriptId: '',
            },
            scopeChain: undefined,
          },
        ],
        reason: 'breakpoint',
        threadSwitchMessage: undefined,
        data: {},
        stopThreadId: 1,
      });
    });
  });

  it('pause - success', () => {
    connectionMultiplexer.pause = jasmine
      .createSpy('pause')
      .andReturn(Promise.resolve(true));
    handler.handleMethod(1, 'pause');
    expect(connectionMultiplexer.pause).toHaveBeenCalledWith();
  });

  it('continue from fake loader bp', () => {
    waitsForPromise(async () => {
      await handler.handleMethod(1, 'resume');
      expect(connectionMultiplexer.listen).toHaveBeenCalledWith(
        jasmine.any(Function),
      );
      expect(clientCallback.sendServerMethod).toHaveBeenCalledWith(
        'Debugger.resumed',
        undefined,
      );
    });
  });

  function testContinuationCommand(chromeCommand, dbgpCommand) {
    return async () => {
      expect(connectionMultiplexer.onStatus).toHaveBeenCalled();

      // Fake the run from loader bp
      await handler.handleMethod(1, 'resume');
      expect(connectionMultiplexer.listen).toHaveBeenCalledWith(
        jasmine.any(Function),
      );
      expect(clientCallback.sendServerMethod).toHaveBeenCalledWith(
        'Debugger.resumed',
        undefined,
      );
      expect(
        connectionMultiplexer.sendContinuationCommand,
      ).not.toHaveBeenCalled();

      connectionMultiplexer.getEnabledConnectionId = jasmine
        .createSpy('getEnabledConnectionId')
        .andReturn(1);
      connectionMultiplexer.getConnectionStopReason = jasmine
        .createSpy('getConnectionStopReason')
        .andReturn('breakpoint');
      connectionMultiplexer.getConnectionStackFrames = jasmine
        .createSpy('getConnectionStackFrames')
        .andReturn(Promise.resolve({stack: []}));

      await handler.handleMethod(1, chromeCommand);

      expect(
        connectionMultiplexer.sendContinuationCommand,
      ).toHaveBeenCalledWith(dbgpCommand);

      await onStatus(ConnectionMultiplexerStatus.Running);
      expect(clientCallback.sendServerMethod).toHaveBeenCalledWith(
        'Debugger.resumed',
        undefined,
      );

      await onStatus(ConnectionMultiplexerStatus.SingleConnectionPaused);
      expect(
        connectionMultiplexer.getConnectionStackFrames,
      ).toHaveBeenCalledWith(1);

      expect(
        clientCallback.sendServerMethod,
      ).toHaveBeenCalledWith('Debugger.paused', {
        callFrames: [],
        reason: 'breakpoint',
        data: {},
        threadSwitchMessage: undefined,
        stopThreadId: 1,
      });
    };
  }

  function testRun(chromeCommand) {
    return async () => {
      expect(connectionMultiplexer.onStatus).toHaveBeenCalled();

      // Fake the run from loader bp
      await handler.handleMethod(1, 'resume');
      expect(connectionMultiplexer.listen).toHaveBeenCalledWith(
        jasmine.any(Function),
      );
      expect(clientCallback.sendServerMethod).toHaveBeenCalledWith(
        'Debugger.resumed',
        undefined,
      );
      expect(connectionMultiplexer.resume).not.toHaveBeenCalled();

      connectionMultiplexer.getEnabledConnectionId = jasmine
        .createSpy('getEnabledConnectionId')
        .andReturn(1);

      connectionMultiplexer.getConnectionStopReason = jasmine
        .createSpy('getConnectionStopReason')
        .andReturn('breakpoint');

      connectionMultiplexer.getConnectionStackFrames = jasmine
        .createSpy('getConnectionStackFrames')
        .andReturn(Promise.resolve({stack: []}));

      await handler.handleMethod(1, chromeCommand);

      expect(connectionMultiplexer.resume).toHaveBeenCalledWith();

      await onStatus(ConnectionMultiplexerStatus.Running);
      expect(clientCallback.sendServerMethod).toHaveBeenCalledWith(
        'Debugger.resumed',
        undefined,
      );

      await onStatus(ConnectionMultiplexerStatus.SingleConnectionPaused);
      expect(
        connectionMultiplexer.getConnectionStackFrames,
      ).toHaveBeenCalledWith(1);
      expect(
        clientCallback.sendServerMethod,
      ).toHaveBeenCalledWith('Debugger.paused', {
        callFrames: [],
        reason: 'breakpoint',
        data: {},
        threadSwitchMessage: undefined,
        stopThreadId: 1,
      });
    };
  }

  it('stepInto', () => {
    waitsForPromise(testContinuationCommand('stepInto', 'step_into'));
  });

  it('stepOut', () => {
    waitsForPromise(testContinuationCommand('stepOut', 'step_out'));
  });

  it('stepOver', () => {
    waitsForPromise(testContinuationCommand('stepOver', 'step_over'));
  });

  it('resume', () => {
    waitsForPromise(testRun('resume'));
  });

  it('stopping', () => {
    expect(
      connectionMultiplexer.sendContinuationCommand,
    ).not.toHaveBeenCalled();
  });

  it('end', () => {
    waitsForPromise(async () => {
      const onSessionEnd = jasmine.createSpy('onSessionEnd');
      handler.onSessionEnd(onSessionEnd);

      await onStatus(ConnectionMultiplexerStatus.End);
      expect(onSessionEnd).toHaveBeenCalledWith();
      expect(onStatusSubscription.dispose).toHaveBeenCalledWith();
    });
  });

  it('removeBreakpoint', () => {
    waitsForPromise(async () => {
      connectionMultiplexer.removeBreakpoint = jasmine
        .createSpy('removeBreakpoint')
        .andCallFake(async () => {});

      await handler.handleMethod(1, 'removeBreakpoint', {
        breakpointId: 42,
      });

      expect(connectionMultiplexer.removeBreakpoint).toHaveBeenCalledWith(42);
      expect(clientCallback.replyToCommand).toHaveBeenCalledWith(
        1,
        {
          id: 42,
        },
        undefined,
      );
    });
  });

  it('setAsyncCallStackDepth', () => {
    handler.handleMethod(1, 'setAsyncCallStackDepth');

    expect(clientCallback.replyWithError).toHaveBeenCalledWith(
      1,
      jasmine.any(String),
    );
  });

  it('skipStackFrames', () => {
    handler.handleMethod(1, 'skipStackFrames');

    expect(clientCallback.replyWithError).toHaveBeenCalledWith(
      1,
      jasmine.any(String),
    );
  });

  it('unknown', () => {
    handler.handleMethod(4, 'unknown');
    expect(clientCallback.replyWithError).toHaveBeenCalledWith(
      4,
      jasmine.any(String),
    );
  });
});
