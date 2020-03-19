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

import * as DebugProtocol from 'vscode-debugprotocol';
import type {
  IVsAdapterSpawner,
  MessageProcessor,
  VSAdapterExecutableInfo,
} from './types';
import type {ProcessMessage} from 'nuclide-commons/process';

import VsAdapterSpawner from './VsAdapterSpawner';
import V8Protocol from './V8Protocol';
import {Observable, Subject, TimeoutError} from 'rxjs';
import idx from 'idx';
import invariant from 'assert';
import {track, trackTiming} from 'nuclide-commons/analytics';
import uuid from 'uuid';

export interface AdapterExitedEvent extends DebugProtocol.DebugEvent {
  event: 'adapter-exited';
  body: {exitCode: number};
}

export type AdapterAnalyticsExtras = {
  adapter: string,
  host: string,
  isRemote: boolean,
};

function raiseAdapterExitedEvent(exitCode: number): AdapterExitedEvent {
  return {
    seq: 0,
    type: 'event',
    event: 'adapter-exited',
    body: {exitCode},
  };
}

type RunInTerminalHandler = (
  arguments: DebugProtocol.RunInTerminalRequestArguments,
) => Promise<void>;

/**
 * Use V8 JSON-RPC protocol to send & receive messages
 * (requests, responses & events) over `stdio` of adapter child processes.
 */
export default class VsDebugSession extends V8Protocol {
  _readyForBreakpoints: boolean;
  _disconnected: boolean;

  _adapterProcessSubscription: ?rxjs$Subscription;
  _startTime: number;

  capabilities: DebugProtocol.Capabilities;
  _adapterExecutable: VSAdapterExecutableInfo;
  _spawner: IVsAdapterSpawner;
  _adapterAnalyticsExtras: AdapterAnalyticsExtras;
  _adapterErrorOutput: string;

  _onDidInitialize: Subject<DebugProtocol.InitializedEvent>;
  _onDidStop: Subject<DebugProtocol.StoppedEvent>;
  _onDidContinued: Subject<DebugProtocol.ContinuedEvent>;
  _onDidTerminateDebugee: Subject<DebugProtocol.TerminatedEvent>;
  _onDidExitDebugee: Subject<DebugProtocol.ExitedEvent>;
  _onDidExitAdapter: Subject<AdapterExitedEvent>;
  _onDidThread: Subject<DebugProtocol.ThreadEvent>;
  _onDidOutput: Subject<DebugProtocol.OutputEvent>;
  _onDidBreakpoint: Subject<DebugProtocol.BreakpointEvent>;
  _onDidModule: Subject<DebugProtocol.ModuleEvent>;
  _onDidLoadSource: Subject<DebugProtocol.LoadedSourceEvent>;
  _onDidCustom: Subject<DebugProtocol.DebugEvent>;
  _onDidEvent: Subject<DebugProtocol.Event | AdapterExitedEvent>;
  _onDidEvaluate: Subject<void>;
  _runInTerminalHandler: ?RunInTerminalHandler;
  _isReadOnly: boolean;

  constructor(
    id: string,
    logger: log4js$Logger,
    adapterExecutable: VSAdapterExecutableInfo,
    adapterAnalyticsExtras: ?AdapterAnalyticsExtras,
    spawner?: IVsAdapterSpawner,
    sendPreprocessors?: MessageProcessor[] = [],
    receivePreprocessors?: MessageProcessor[] = [],
    runInTerminalHandler?: RunInTerminalHandler,
    isReadOnly?: boolean = false,
  ) {
    super(id, logger, sendPreprocessors, receivePreprocessors);
    this._adapterExecutable = adapterExecutable;
    this._readyForBreakpoints = false;
    this._spawner = spawner == null ? new VsAdapterSpawner() : spawner;
    this._isReadOnly = isReadOnly;
    this._adapterAnalyticsExtras = {
      ...adapterAnalyticsExtras,
      // $FlowFixMe flow doesn't consider uuid callable, but it is
      debuggerSessionId: uuid(),
    };
    this._adapterErrorOutput = '';

    this._onDidInitialize = new Subject();
    this._onDidStop = new Subject();
    this._onDidContinued = new Subject();
    this._onDidTerminateDebugee = new Subject();
    this._onDidExitDebugee = new Subject();
    this._onDidExitAdapter = new Subject();
    this._onDidThread = new Subject();
    this._onDidOutput = new Subject();
    this._onDidBreakpoint = new Subject();
    this._onDidModule = new Subject();
    this._onDidLoadSource = new Subject();
    this._onDidCustom = new Subject();
    this._onDidEvent = new Subject();
    this._onDidEvaluate = new Subject();
    this.capabilities = {};
    this._runInTerminalHandler = runInTerminalHandler || null;
  }

  observeInitializeEvents(): Observable<DebugProtocol.InitializedEvent> {
    return this._onDidInitialize.asObservable();
  }

  observeStopEvents(): Observable<DebugProtocol.StoppedEvent> {
    return this._onDidStop.asObservable();
  }

  observeContinuedEvents(): Observable<DebugProtocol.ContinuedEvent> {
    return this._onDidContinued.asObservable();
  }

  observeTerminateDebugeeEvents(): Observable<DebugProtocol.TerminatedEvent> {
    return this._onDidTerminateDebugee.asObservable();
  }

  observeExitedDebugeeEvents(): Observable<DebugProtocol.ExitedEvent> {
    return this._onDidExitDebugee.asObservable();
  }

  observeAdapterExitedEvents(): Observable<AdapterExitedEvent> {
    return this._onDidExitAdapter.asObservable();
  }

  observeThreadEvents(): Observable<DebugProtocol.ThreadEvent> {
    return this._onDidThread.asObservable();
  }

  observeOutputEvents(): Observable<DebugProtocol.OutputEvent> {
    return this._onDidOutput.asObservable();
  }

  observeBreakpointEvents(): Observable<DebugProtocol.BreakpointEvent> {
    return this._onDidBreakpoint.asObservable();
  }

  observeModuleEvents(): Observable<DebugProtocol.ModuleEvent> {
    return this._onDidModule.asObservable();
  }

  observeSourceLoadedEvents(): Observable<DebugProtocol.LoadedSourceEvent> {
    return this._onDidLoadSource.asObservable();
  }

  observeCustomEvents(): Observable<DebugProtocol.DebugEvent> {
    return this._onDidCustom.asObservable();
  }

  observeEvaluations(): Observable<void> {
    return this._onDidEvaluate.asObservable();
  }

  observeAllEvents(): Observable<DebugProtocol.Event | AdapterExitedEvent> {
    return this._onDidEvent.asObservable();
  }

  _initServer(): void {
    if (this._adapterProcessSubscription != null) {
      return;
    }

    this._startServer();
    this._startTime = new Date().getTime();
  }

  custom(request: string, args: any): Promise<DebugProtocol.CustomResponse> {
    return this.send(request, args);
  }

  send(command: string, args: any): Promise<any> {
    this._initServer();

    const operation = (): Promise<any> => {
      // Babel Bug: `super` isn't working with `async`
      return super.send(command, args).then(
        (response: DebugProtocol.Response) => {
          const sanitizedResponse = this._sanitizeResponse(response);
          track('vs-debug-session:transaction', {
            ...this._adapterAnalyticsExtras,
            request: {command, arguments: args},
            response: sanitizedResponse,
          });
          return response;
        },
        (errorResponse: DebugProtocol.ErrorResponse) => {
          let errorMessage = null;
          let showUser = false;
          const errorFormatString = errorResponse.body?.error?.format || '';
          if (errorFormatString !== '') {
            const errorObject: DebugProtocol.Message = (errorResponse.body
              .error: any);
            // Protocol response contained an ErrorResponse with details
            // about how the debug adapter wants us to handle the error.
            errorMessage = String(errorFormatString);
            showUser = Boolean(errorObject.showUser);
            const variables = errorObject.variables;
            if (variables != null) {
              for (const key of Object.keys(variables)) {
                const pattern = new RegExp('{' + key + '}', 'g');
                errorMessage = errorMessage.replace(pattern, variables[key]);
              }
            }

            // TODO: Allow the consumer of the session to register a global
            // error handler routine so we can still present errors even
            // when running outside of Atom.
            if (Boolean(showUser) && typeof atom !== 'undefined') {
              atom.notifications.addError(errorMessage);
            }
          } else if (errorResponse.message != null) {
            // Response message contained a user-facing string to display.
            errorMessage = errorResponse.message;
          } else {
            // See if Response message contained a user-facing string to display.
            // The protocol expects message to be on result, not result.body
            // but some debug adapters are doing this incorrectly. Work with
            // them anyway...
            // $FlowIgnore
            errorMessage = errorResponse.body?.message;
          }

          track('vs-debug-session:transaction', {
            ...this._adapterAnalyticsExtras,
            request: {command, arguments: args},
            response: errorResponse,
          });

          if (errorMessage != null) {
            throw new Error(errorMessage);
          }

          // If the debug adapter didn't specify what error to
          // show the user, fallback to logging the request/response info.
          let formattedError =
            idx(errorResponse, _ => _.body.error.format) ||
            idx(errorResponse, _ => _.message);
          if (formattedError === '{_stack}') {
            formattedError = JSON.stringify(errorResponse.body.error);
          } else if (formattedError == null) {
            formattedError = [
              `command: ${command}`,
              `args: ${JSON.stringify(args)}`,
              `response: ${JSON.stringify(errorResponse)}`,
              `adapterExecutable: , ${JSON.stringify(this._adapterExecutable)}`,
            ].join(', ');
          }
          throw new Error(formattedError);
        },
      );
    };

    return trackTiming(
      `vs-debug-session:${command}`,
      operation,
      this._adapterAnalyticsExtras,
    );
  }

  _sanitizeResponse(
    response: DebugProtocol.base$Response,
  ): DebugProtocol.base$Response {
    try {
      if (response.command === 'variables') {
        const varResponse = ((response: any): DebugProtocol.VariablesResponse);
        const sanResponse = {
          ...varResponse,
          body: {
            ...varResponse.body,
            variables: varResponse.body.variables.map(v => ({
              ...v,
              value: '<elided>',
            })),
          },
        };
        // $FlowFixMe flow isn't recognizing that ...varResponse is filling in needed members
        return sanResponse;
      }
      if (response.command === 'evaluate') {
        const evalResponse = ((response: any): DebugProtocol.EvaluateResponse);
        const sanResponse = {
          ...evalResponse,
          body: {
            ...evalResponse.body,
            result: '<elided>',
          },
        };
        // $FlowFixMe flow isn't recognizing that ...evalResponse is filling in needed members
        return sanResponse;
      }
      return response;
    } catch (e) {
      // Don't let a malformed response prevent the response from bubbling up
      // to the debugger
      return {
        type: 'response',
        seq: response.seq,
        request_seq: response.request_seq,
        success: false,
        command: response.command,
        error: 'Error sanitizing response.',
        message: e.message,
      };
    }
  }

  onEvent(event: DebugProtocol.Event | AdapterExitedEvent): void {
    if (event.body != null) {
      // $FlowFixMe `sessionId` isn't in the type def.
      event.body.sessionId = this.getId();
    } else {
      // $FlowFixMe `event.body` type def.
      event.body = {sessionId: this.getId()};
    }

    track('vs-debug-session:transaction', {
      ...this._adapterAnalyticsExtras,
      event,
    });

    this._onDidEvent.next(event);

    switch (event.event) {
      case 'initialized':
        this._readyForBreakpoints = true;
        this._onDidInitialize.next(event);
        break;
      case 'stopped':
        this._onDidStop.next(event);
        break;
      case 'continued':
        this._onDidContinued.next(event);
        break;
      case 'thread':
        this._onDidThread.next(event);
        break;
      case 'output':
        this._onDidOutput.next(event);
        break;
      case 'breakpoint':
        this._onDidBreakpoint.next(event);
        break;
      case 'terminated':
        this._onDidTerminateDebugee.next(event);
        break;
      case 'exited':
        this._onDidExitDebugee.next(event);
        break;
      case 'adapter-exited':
        this._onDidExitAdapter.next(event);
        break;
      case 'module':
        this._onDidModule.next(event);
        break;
      case 'loadedSource':
        this._onDidLoadSource.next(event);
        break;
      default:
        this._onDidCustom.next(event);
        this._logger.info('Custom event type:', event);
        break;
    }
  }

  getCapabilities(): DebugProtocol.Capabilities {
    return this.capabilities;
  }

  async initialize(
    args: DebugProtocol.InitializeRequestArguments,
  ): Promise<DebugProtocol.InitializeResponse> {
    const response = await this.send('initialize', args);
    return this._readCapabilities(response);
  }

  _readCapabilities(response: any): any {
    if (response) {
      this.capabilities = {
        ...this.capabilities,
        ...response.body,
      };
    }
    return response;
  }

  async launch(
    args: DebugProtocol.LaunchRequestArguments,
  ): Promise<DebugProtocol.LaunchResponse> {
    const response = await this.send('launch', args);
    return this._readCapabilities(response);
  }

  async attach(
    args: DebugProtocol.AttachRequestArguments,
  ): Promise<DebugProtocol.AttachResponse> {
    const response = await this.send('attach', args);
    return this._readCapabilities(response);
  }

  next(args: DebugProtocol.NextArguments): Promise<DebugProtocol.NextResponse> {
    if (this._isReadOnly) {
      throw new Error('Read only target cannot step.');
    }

    this._fireFakeContinued(args.threadId);
    return this.send('next', args);
  }

  stepIn(
    args: DebugProtocol.StepInArguments,
  ): Promise<DebugProtocol.StepInResponse> {
    if (this._isReadOnly) {
      throw new Error('Read only target cannot step.');
    }

    this._fireFakeContinued(args.threadId);
    return this.send('stepIn', args);
  }

  stepOut(
    args: DebugProtocol.StepOutArguments,
  ): Promise<DebugProtocol.StepOutResponse> {
    if (this._isReadOnly) {
      throw new Error('Read only target cannot step.');
    }

    this._fireFakeContinued(args.threadId);
    return this.send('stepOut', args);
  }

  continue(
    args: DebugProtocol.ContinueArguments,
  ): Promise<DebugProtocol.ContinueResponse> {
    if (this._isReadOnly) {
      throw new Error('Read only target cannot continue.');
    }

    this._fireFakeContinued(args.threadId);
    return this.send('continue', args);
  }

  pause(
    args: DebugProtocol.PauseArguments,
  ): Promise<DebugProtocol.PauseResponse> {
    if (this._isReadOnly) {
      throw new Error('Read only target cannot pause.');
    }

    return this.send('pause', args);
  }

  setVariable(
    args: DebugProtocol.SetVariableArguments,
  ): Promise<DebugProtocol.SetVariableResponse> {
    if (this._isReadOnly) {
      throw new Error('Read only target cannot set variable.');
    }

    return this.send('setVariable', args).then(response => {
      this._onDidEvaluate.next();
      return response;
    });
  }

  restartFrame(
    args: DebugProtocol.RestartFrameArguments,
    threadId: number,
  ): Promise<DebugProtocol.RestartFrameResponse> {
    if (this._isReadOnly) {
      throw new Error('Read only target cannot restart frame.');
    }

    this._fireFakeContinued(threadId);
    return this.send('restartFrame', args);
  }

  completions(
    args: DebugProtocol.CompletionsArguments,
  ): Promise<DebugProtocol.CompletionsResponse> {
    return this.send('completions', args);
  }

  async disconnect(
    restart?: boolean = false,
    force?: boolean = false,
  ): Promise<void> {
    if (this._disconnected && force) {
      this._stopServer();
      return;
    }

    if (this._adapterProcessSubscription != null && !this._disconnected) {
      // point of no return: from now on don't report any errors
      this._disconnected = true;
      await Observable.fromPromise(this.send('disconnect', {restart}))
        .timeout(5000)
        .catch(err => {
          if (!(err instanceof TimeoutError)) {
            throw err;
          }
          return Observable.empty();
        })
        .toPromise();
      this._stopServer();
    }
  }

  setBreakpoints(
    args: DebugProtocol.SetBreakpointsArguments,
  ): Promise<DebugProtocol.SetBreakpointsResponse> {
    return this.send('setBreakpoints', args);
  }

  setFunctionBreakpoints(
    args: DebugProtocol.SetFunctionBreakpointsArguments,
  ): Promise<DebugProtocol.SetFunctionBreakpointsResponse> {
    return this.send('setFunctionBreakpoints', args);
  }

  setExceptionBreakpoints(
    args: DebugProtocol.SetExceptionBreakpointsArguments,
  ): Promise<DebugProtocol.SetExceptionBreakpointsResponse> {
    return this.send('setExceptionBreakpoints', args);
  }

  configurationDone(): Promise<DebugProtocol.ConfigurationDoneResponse> {
    return this.send('configurationDone', null);
  }

  stackTrace(
    args: DebugProtocol.StackTraceArguments,
  ): Promise<DebugProtocol.StackTraceResponse> {
    return this.send('stackTrace', args);
  }

  exceptionInfo(
    args: DebugProtocol.ExceptionInfoArguments,
  ): Promise<DebugProtocol.ExceptionInfoResponse> {
    return this.send('exceptionInfo', args);
  }

  info(args: DebugProtocol.InfoArguments): Promise<DebugProtocol.InfoResponse> {
    return this.send('info', args);
  }

  scopes(
    args: DebugProtocol.ScopesArguments,
  ): Promise<DebugProtocol.ScopesResponse> {
    return this.send('scopes', args);
  }

  variables(
    args: DebugProtocol.VariablesArguments,
  ): Promise<DebugProtocol.VariablesResponse> {
    return this.send('variables', args);
  }

  source(
    args: DebugProtocol.SourceArguments,
  ): Promise<DebugProtocol.SourceResponse> {
    return this.send('source', args);
  }

  threads(): Promise<DebugProtocol.ThreadsResponse> {
    return this.send('threads', null);
  }

  evaluate(
    args: DebugProtocol.EvaluateArguments,
  ): Promise<DebugProtocol.EvaluateResponse> {
    return this.send('evaluate', args).then(result => {
      if (args.context === 'repl') {
        this._onDidEvaluate.next();
      }
      return result;
    });
  }

  stepBack(
    args: DebugProtocol.StepBackArguments,
  ): Promise<DebugProtocol.StepBackResponse> {
    this._fireFakeContinued(args.threadId);
    return this.send('stepBack', args);
  }

  reverseContinue(
    args: DebugProtocol.ReverseContinueArguments,
  ): Promise<DebugProtocol.ReverseContinueResponse> {
    if (this._isReadOnly) {
      throw new Error('Read only target cannot reverse continue.');
    }

    this._fireFakeContinued(args.threadId);
    return this.send('reverseContinue', args);
  }

  nuclide_continueToLocation(
    args: DebugProtocol.nuclide_ContinueToLocationArguments,
  ): Promise<DebugProtocol.nuclide_ContinueToLocationResponse> {
    if (this._isReadOnly) {
      throw new Error('Read only target cannot run to location.');
    }

    return this.custom('nuclide_continueToLocation', args);
  }

  getLengthInSeconds(): number {
    return (new Date().getTime() - this._startTime) / 1000;
  }

  async dispatchRequest(
    request: DebugProtocol.Request,
    response: DebugProtocol.Response,
  ): Promise<void> {
    if (request.command === 'runInTerminal') {
      const runInTerminalHandler = this._runInTerminalHandler;
      if (runInTerminalHandler == null) {
        this._logger.error(
          "'runInTerminal' isn't supported for this debug session",
          request,
        );
        return;
      }
      try {
        await runInTerminalHandler((request.arguments: any));
      } catch (error) {
        response.success = false;
        response.message = error.message;
      }
      this.sendResponse(response);
    } else if (request.command === 'handshake') {
      this._logger.error('TODO: handshake', request);
    } else {
      response.success = false;
      response.message = `unknown request '${request.command}'`;
      this.sendResponse(response);
    }
  }

  _fireFakeContinued(
    threadId: number,
    allThreadsContinued?: boolean = false,
  ): void {
    const event: DebugProtocol.ContinuedEvent = {
      type: 'event',
      event: 'continued',
      body: {
        threadId,
        // $FlowFixMe
        allThreadsContinued,
      },
      seq: 0,
    };
    this._onDidContinued.next(event);
    this._onDidEvent.next(event);
  }

  _startServer(): void {
    this._adapterProcessSubscription = this._spawner
      .spawnAdapter(this._adapterExecutable)
      .refCount()
      .subscribe((message: ProcessMessage) => {
        if (message.kind === 'stdout') {
          this.handleData(new Buffer(message.data));
        } else if (message.kind === 'stderr') {
          const event: DebugProtocol.OutputEvent = ({
            type: 'event',
            event: 'output',
            body: {
              category: 'stderr',
              output: message.data,
            },
            seq: 0,
          }: any);
          this._onDidOutput.next(event);
          this._onDidEvent.next(event);
          this._logger.error(`adapter stderr: ${message.data}`);
          this._adapterErrorOutput = this._adapterErrorOutput + message.data;
        } else {
          invariant(message.kind === 'exit');
          const exitCode = message.exitCode || 0;
          if (exitCode === 0) {
            this.onServerExit(message.exitCode || 0);
          } else {
            this.onServerError(
              new Error(`Debug adapter exited with code: ${exitCode}`),
            );
          }
        }
      });

    this.setOutput(this._spawner.write.bind(this._spawner));
  }

  _stopServer(): void {
    this.onEvent(raiseAdapterExitedEvent(0));
    if (this._adapterProcessSubscription == null) {
      return;
    }

    this._disconnected = true;
    this._adapterProcessSubscription.unsubscribe();
    this._endHandlers();
  }

  _endHandlers(): void {
    this._onDidInitialize.complete();
    this._onDidStop.complete();
    this._onDidContinued.complete();
    this._onDidTerminateDebugee.complete();
    this._onDidExitDebugee.complete();
    this._onDidExitAdapter.complete();
    this._onDidThread.complete();
    this._onDidOutput.complete();
    this._onDidBreakpoint.complete();
    this._onDidModule.complete();
    this._onDidLoadSource.complete();
    this._onDidCustom.complete();
    this._onDidEvent.complete();
  }

  onServerError(error: Error): void {
    this._logger.error('Adapter error:', error);
    this._stopServer();
  }

  onServerExit(code: number): void {
    if (this._adapterProcessSubscription != null) {
      this._adapterProcessSubscription.unsubscribe();
      this._adapterProcessSubscription = null;
    }
    if (!this._disconnected) {
      this._logger.error(
        `Debug adapter process has terminated unexpectedly ${code}`,
      );
    }
    this.onEvent(raiseAdapterExitedEvent(code));
  }

  isReadyForBreakpoints(): boolean {
    return this._readyForBreakpoints;
  }

  isDisconnected(): boolean {
    return this._disconnected;
  }

  dispose(): void {
    if (this._adapterErrorOutput) {
      track('vs-debug-session:transaction', {
        ...this._adapterAnalyticsExtras,
        response: this._adapterErrorOutput,
      });
    }
    this.disconnect();
  }
}
