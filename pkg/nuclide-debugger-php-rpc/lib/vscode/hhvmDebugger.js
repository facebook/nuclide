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

import type {PhpDebuggerSessionConfig} from '../PhpDebuggerService';

import {
  Logger,
  logger,
  DebugSession,
  LoggingDebugSession,
  InitializedEvent,
  Thread,
} from 'vscode-debugadapter';
import * as DebugProtocol from 'vscode-debugprotocol';
import nullthrows from 'nullthrows';
import {DebuggerHandler} from '../DebuggerHandler';
import {setConfig} from '../config';
import {setRootDirectoryUri} from '../ConnectionUtils';
import nuclideLogger from '../utils';

/**
 * This interface should always match the schema found in nuclide's vscode extension manifest.
 */
export interface LaunchRequestArguments
  extends DebugProtocol.LaunchRequestArguments {
  config: PhpDebuggerSessionConfig,
  /** enable logging the Debug Adapter Protocol */
  trace?: boolean,
}

class HhvmDebugSession extends LoggingDebugSession {
  _debuggerHandler: DebuggerHandler;

  /**
   * Creates a new debug adapter that is used for one debug session.
   * We configure the default implementation of a debug adapter here.
   */
  constructor() {
    super('hhvm-debug');

    // this debugger uses zero-based lines and columns
    this.setDebuggerLinesStartAt1(true);
    this.setDebuggerColumnsStartAt1(true);

    this._debuggerHandler = new DebuggerHandler(this.sendEvent.bind(this));
  }

  /**
   * The 'initialize' request is the first request called by the frontend
   * to interrogate the features the debug adapter provides.
   */
  initializeRequest(
    response: DebugProtocol.InitializeResponse,
    args: DebugProtocol.InitializeRequestArguments,
  ): void {
    // since this debug adapter can accept configuration requests like 'setBreakpoint' at any time,
    // we request them early by sending an 'initializeRequest' to the frontend.
    // The frontend will end the configuration sequence by calling 'configurationDone' request.
    this.sendEvent(new InitializedEvent());

    response.body = response.body || {};
    response.body.supportsConfigurationDoneRequest = true;
    response.body.supportsEvaluateForHovers = true;
    response.body.exceptionBreakpointFilters = [
      {
        label: 'All Exceptions',
        filter: 'all',
      },
    ];
    response.body.supportsConditionalBreakpoints = true;

    this.sendResponse(response);
  }

  async launchRequest(
    response: DebugProtocol.LaunchResponse,
    args: LaunchRequestArguments,
  ): Promise<void> {
    // make sure to 'Stop' the buffered logging if 'trace' is not set
    logger.setup(
      args.trace ? Logger.LogLevel.Verbose : Logger.LogLevel.Stop,
      false,
    );

    // Yuckky: Setting a global config to be used by the debugger.
    setConfig(args.config);
    await setRootDirectoryUri(args.config.targetUri);
    nuclideLogger.setLevel(args.config.logLevel);

    // TODO Get rid of legacy: Resume to start the debug session.
    this._debuggerHandler.resume();

    this.sendResponse(response);
  }

  async setBreakPointsRequest(
    response: DebugProtocol.SetBreakpointsResponse,
    args: DebugProtocol.SetBreakpointsArguments,
  ): Promise<void> {
    const breakpoints = await this._debuggerHandler.setBreakpoints(
      nullthrows(args.source.path),
      nullthrows(args.breakpoints),
    );
    // Send back the actual breakpoint positions.
    response.body = {
      breakpoints,
    };
    this.sendResponse(response);
  }

  async setExceptionBreakPointsRequest(
    response: DebugProtocol.SetExceptionBreakpointsResponse,
    args: DebugProtocol.SetExceptionBreakpointsArguments,
  ): Promise<void> {
    let state;
    if (args.filters.indexOf('uncaught') !== -1) {
      state = 'uncaught';
    } else if (args.filters.indexOf('all') !== -1) {
      state = 'all';
    } else {
      state = 'none';
    }
    await this._debuggerHandler.setPauseOnExceptions(
      this._breakpointId++,
      state,
    );
    this.sendResponse(response);
  }

  // TODO(most): proper thread updates support.
  threadsRequest(response: DebugProtocol.ThreadsResponse): void {
    response.body = {
      threads: [new Thread(1, 'thread 1')],
    };
    this.sendResponse(response);
  }

  /**
   * Returns a fake 'stacktrace' where every 'stackframe' is a word from the current line.
   */
  async stackTraceRequest(
    response: DebugProtocol.StackTraceResponse,
    args: DebugProtocol.StackTraceArguments,
  ): Promise<void> {
    const frames = await this._debuggerHandler.getStackFrames(args.threadId);
    response.body = {
      stackFrames: frames,
    };
    this.sendResponse(response);
  }

  async scopesRequest(
    response: DebugProtocol.ScopesResponse,
    args: DebugProtocol.ScopesArguments,
  ): Promise<void> {
    const scopes = await this._debuggerHandler.getScopesForFrame(args.frameId);
    response.body = {
      scopes,
    };
    this.sendResponse(response);
  }

  async variablesRequest(
    response: DebugProtocol.VariablesResponse,
    args: DebugProtocol.VariablesArguments,
  ): Promise<void> {
    const variables = await this._debuggerHandler.getProperties(
      args.variablesReference,
    );
    response.body = {
      variables,
    };
    this.sendResponse(response);
  }

  continueRequest(
    response: DebugProtocol.ContinueResponse,
    args: DebugProtocol.ContinueArguments,
  ): void {
    this.sendResponse(response);
    this._debuggerHandler.resume();
  }

  pauseRequest(
    response: DebugProtocol.PauseResponse,
    args: DebugProtocol.PauseArguments,
  ): void {
    this.sendResponse(response);
    this._debuggerHandler.pause();
  }

  nextRequest(
    response: DebugProtocol.NextResponse,
    args: DebugProtocol.NextArguments,
  ): void {
    this.sendResponse(response);
    this._debuggerHandler.stepOver();
  }

  stepInRequest(
    response: DebugProtocol.StepInResponse,
    args: DebugProtocol.StepInTargetsArguments,
  ): void {
    this.sendResponse(response);
    this._debuggerHandler.stepInto();
  }

  stepOutRequest(
    response: DebugProtocol.StepInResponse,
    args: DebugProtocol.StepOutArguments,
  ): void {
    this.sendResponse(response);
    this._debuggerHandler.stepOut();
  }

  async evaluateRequest(
    response: DebugProtocol.EvaluateResponse,
    args: DebugProtocol.EvaluateArguments,
  ): Promise<void> {
    await this._debuggerHandler.evaluate(
      args.expression,
      args.frameId,
      response,
    );
    this.sendResponse(response);
  }

  async nuclide_continueToLocation(
    response: DebugProtocol.nuclide_ContinueToLocationResponse,
    args: DebugProtocol.nuclide_ContinueToLocationArguments,
  ): Promise<void> {
    await this._debuggerHandler.continueToLocation(args);
    this.sendResponse(response);
  }

  customRequest(
    command: string,
    response: DebugProtocol.Response,
    args: any,
  ): void {
    switch (command) {
      case 'nuclide_continueToLocation':
        this.nuclide_continueToLocation(response, args);
        return;
      default:
        return super.customRequest(command, response, args);
    }
  }
}

DebugSession.run(HhvmDebugSession);
