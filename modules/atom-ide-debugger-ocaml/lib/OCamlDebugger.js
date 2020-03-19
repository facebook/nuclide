/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import {
  DebugSession,
  InitializedEvent,
  logger,
  LoggingDebugSession,
  OutputEvent,
  TerminatedEvent,
  Thread,
  StoppedEvent,
} from 'vscode-debugadapter';
import * as DebugProtocol from 'vscode-debugprotocol';
import {Session} from './Session';

export const THREAD_ID = 1;

export type OCamlDebugStartInfo = {
  ocamldebugExecutable: string,
  executablePath: string,
  arguments: Array<string>,
  environmentVariables: Array<string>,
  workingDirectory: string,
  includeDirectories: Array<string>,
  breakAfterStart: boolean,
  logLevel: number,
};

export type LaunchRequestArguments = DebugProtocol.LaunchRequestArguments &
  OCamlDebugStartInfo;

class OCamlDebugSession extends LoggingDebugSession {
  _session: Session;
  _started = false;
  _breakAfterStart: boolean;

  /**
   * Creates a new debug adapter that is used for one debug session.
   * We configure the default implementation of a debug adapter here.
   */
  constructor() {
    super('ocaml-debug');

    // this debugger uses zero-based lines and columns
    this.setDebuggerLinesStartAt1(true);
    this.setDebuggerColumnsStartAt1(true);
  }

  _catchAsyncRequestError(
    response: ?DebugProtocol.base$Response,
    fn: () => Promise<mixed>,
  ) {
    fn().catch(error => {
      const errorMessage = error.stack || error.message || String(error);
      if (response != null) {
        response.success = false;
        // $FlowIgnore: returning an ErrorResponse.
        response.body = {
          error: {
            id: -1,
            format: errorMessage,
          },
        };
        this.sendResponse(response);
      }
      this.sendEvent(
        new OutputEvent(
          `OCaml Debugger ran into an error:\n\`${errorMessage}\``,
          'nuclide_notification',
          {type: 'error'},
        ),
      );
      this.sendEvent(new TerminatedEvent());
    });
  }

  /**
   * The 'initialize' request is the first request called by the frontend
   * to interrogate the features the debug adapter provides.
   */
  initializeRequest(
    response: DebugProtocol.InitializeResponse,
    args: DebugProtocol.InitializeRequestArguments,
  ): void {
    response.body = {
      supportsConfigurationDoneRequest: true,
      supportsEvaluateForHovers: true,
      // TODO: requires Nuclide UI support.
      // supportsStepBack: true,
    };
    this.sendResponse(response);
  }

  launchRequest(
    response: DebugProtocol.LaunchResponse,
    args: LaunchRequestArguments,
  ): void {
    this._catchAsyncRequestError(response, async () => {
      const config = {
        ...args,
      };

      // make sure to 'Stop' the buffered logging if 'trace' is not set
      logger.setup(config.logLevel, false);

      this._session = await Session.start(
        config,
        breakPointId => this._handleBreakpointHitEvent(breakPointId),
        error => this._handleProgramExitedEvent(error),
      );
      this._breakAfterStart = config.breakAfterStart;

      // Now send the initialized event as we're ready to process breakpoint requests
      this.sendEvent(new InitializedEvent());

      this.sendResponse(response);
      this.sendEvent(new StoppedEvent('Program entry', THREAD_ID));
    });
  }

  setBreakPointsRequest(
    response: DebugProtocol.SetBreakpointsResponse,
    args: DebugProtocol.SetBreakpointsArguments,
  ): void {
    this._catchAsyncRequestError(response, async () => {
      const breakpoints = await this._session.setBreakpointsByUri(
        args.breakpoints || [],
        args.source.path,
        args.source.name,
      );

      response.body = {
        breakpoints,
      };
      this.sendResponse(response);
    });
  }

  setExceptionBreakPointsRequest(
    response: DebugProtocol.SetExceptionBreakpointsResponse,
    args: DebugProtocol.SetExceptionBreakpointsArguments,
  ): void {
    this.sendResponse(response);
  }

  configurationDoneRequest(
    response: DebugProtocol.ConfigurationDoneResponse,
    args: DebugProtocol.ConfigurationDoneRequest,
  ): void {
    this._catchAsyncRequestError(response, async () => {
      if (this._breakAfterStart) {
        this.sendEvent(new StoppedEvent('Program start', THREAD_ID));
      } else {
        await this._session.resume();
      }

      this.sendResponse(response);
    });
  }

  threadsRequest(response: DebugProtocol.ThreadsResponse): void {
    response.body = {
      threads: [new Thread(THREAD_ID, '')],
    };
    this.sendResponse(response);
  }

  stackTraceRequest(
    response: DebugProtocol.StackTraceResponse,
    args: DebugProtocol.StackTraceArguments,
  ): void {
    this._catchAsyncRequestError(response, async () => {
      response.body = {
        stackFrames: await this._session.getStack(),
      };
      this.sendResponse(response);
    });
  }

  scopesRequest(
    response: DebugProtocol.ScopesResponse,
    args: DebugProtocol.ScopesArguments,
  ): void {
    this._catchAsyncRequestError(response, async () => {
      this.sendResponse(response);
    });
  }

  variablesRequest(
    response: DebugProtocol.VariablesResponse,
    args: DebugProtocol.VariablesArguments,
  ): void {
    this._catchAsyncRequestError(response, async () => {
      this.sendResponse(response);
    });
  }

  evaluateRequest(
    response: DebugProtocol.EvaluateResponse,
    args: DebugProtocol.EvaluateArguments,
  ): void {
    this._catchAsyncRequestError(response, async () => {
      const result = await this._session.evaluate(
        args.frameId,
        args.expression,
      );

      response.body = {
        result,
        variablesReference: 0,
      };
      this.sendResponse(response);
    });
  }

  continueRequest(
    response: DebugProtocol.ContinueResponse,
    args: DebugProtocol.ContinueArguments,
  ): void {
    this._catchAsyncRequestError(response, async () => {
      await this._session.resume();
      this.sendResponse(response);
    });
  }

  pauseRequest(
    response: DebugProtocol.PauseResponse,
    args: DebugProtocol.PauseArguments,
  ): void {
    this._catchAsyncRequestError(null, async () => {
      await this._session.pause();
      this.sendResponse(response);
    });
  }

  nextRequest(
    response: DebugProtocol.NextResponse,
    args: DebugProtocol.NextArguments,
  ): void {
    this._catchAsyncRequestError(null, async () => {
      await this._session.stepOver();
      this.sendResponse(response);
      this.sendEvent(new StoppedEvent('Stepped', THREAD_ID));
    });
  }

  stepInRequest(
    response: DebugProtocol.StepInResponse,
    args: DebugProtocol.StepInArguments,
  ): void {
    this._catchAsyncRequestError(null, async () => {
      await this._session.stepInto();
      this.sendResponse(response);
      this.sendEvent(new StoppedEvent('Stepped', THREAD_ID));
    });
  }

  stepOutRequest(
    response: DebugProtocol.StepOutResponse,
    args: DebugProtocol.StepOutArguments,
  ): void {
    this._catchAsyncRequestError(null, async () => {
      await this._session.stepOut();
      this.sendResponse(response);
      this.sendEvent(new StoppedEvent('Stepped', THREAD_ID));
    });
  }

  _handleBreakpointHitEvent(breakpointId: string): Promise<void> {
    this.sendEvent(new StoppedEvent('Breakpoint hit', THREAD_ID));
    return Promise.resolve();
  }

  _handleProgramExitedEvent(error: ?string): Promise<void> {
    this.sendEvent(new TerminatedEvent());
    return Promise.resolve();
  }
}

DebugSession.run(OCamlDebugSession);
