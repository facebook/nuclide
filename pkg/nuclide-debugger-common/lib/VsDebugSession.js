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

import * as DebugProtocol from 'vscode-debugprotocol';
import type {VSAdapterExecutableInfo} from './types';

import child_process from 'child_process';
import V8Protocol from './V8Protocol';
import {
  killProcess,
  logStreamErrors,
  preventStreamsFromThrowing,
} from 'nuclide-commons/process';
import {Observable, Subject} from 'rxjs';
import idx from 'idx';
import {getOriginalEnvironment} from 'nuclide-commons/process';

export interface AdapterExitedEvent extends DebugProtocol.base$Event {
  event: 'adapter-exited',
  body: {exitCode: number},
}

function raiseAdapterExitedEvent(exitCode: number): AdapterExitedEvent {
  return {
    seq: 0,
    type: 'event',
    event: 'adapter-exited',
    body: {exitCode: 0},
  };
}

/**
 * Use V8 JSON-RPC protocol to send & receive messages
 * (requests, responses & events) over `stdio` of adapter child processes.
 */
export default class VsDebugSession extends V8Protocol {
  _readyForBreakpoints: boolean;
  _disconnected: boolean;

  _serverProcess: ?child_process$ChildProcess;
  _cachedInitServer: ?Promise<void>;
  _startTime: number;

  _capabilities: DebugProtocol.Capabilities;
  _adapterExecutable: VSAdapterExecutableInfo;
  _logger: log4js$Logger;

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
  _onDidEvent: Subject<DebugProtocol.Event | AdapterExitedEvent>;

  constructor(
    id: string,
    logger: log4js$Logger,
    adapterExecutable: VSAdapterExecutableInfo,
  ) {
    super(id, logger);
    this._adapterExecutable = adapterExecutable;
    this._logger = logger;
    this._readyForBreakpoints = false;

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
    this._onDidEvent = new Subject();
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

  observeAllEvents(): Observable<DebugProtocol.Event | AdapterExitedEvent> {
    return this._onDidEvent.asObservable();
  }

  _initServer(): Promise<void> {
    if (this._cachedInitServer) {
      return this._cachedInitServer;
    }

    const serverPromise = this._startServer();
    this._cachedInitServer = serverPromise.then(
      () => {
        this._startTime = new Date().getTime();
      },
      err => {
        this._cachedInitServer = null;
        return Promise.reject(err);
      },
    );

    return this._cachedInitServer;
  }

  custom(request: string, args: any): Promise<DebugProtocol.CustomResponse> {
    return this.send(request, args);
  }

  send(command: string, args: any): Promise<any> {
    this._logger.info('Send request:', command, args);
    return this._initServer().then(() =>
      // Babel Bug: `super` isn't working with `async`.
      super.send(command, args).then(
        response => {
          this._logger.info('Received response:', response);
          return response;
        },
        (errorResponse: DebugProtocol.ErrorResponse) => {
          const errorMessage =
            idx(errorResponse, _ => _.body.error.format) ||
            JSON.stringify(errorResponse);
          throw new Error(errorMessage);
        },
      ),
    );
  }

  onEvent(event: DebugProtocol.Event | AdapterExitedEvent): void {
    if (event.body != null) {
      // $FlowFixMe `sessionId` isn't in the type def.
      event.body.sessionId = this.getId();
    } else {
      // $FlowFixMe `event.body` type def.
      event.body = {sessionId: this.getId()};
    }

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
        this._logger.error('Unknonwn event type:', event);
        break;
    }
  }

  getCapabilities(): DebugProtocol.Capabilities {
    return this._capabilities || {};
  }

  async initialize(
    args: DebugProtocol.InitializeRequestArguments,
  ): Promise<DebugProtocol.InitializeResponse> {
    const response = await this.send('initialize', args);
    return this._readCapabilities(response);
  }

  _readCapabilities(response: any): any {
    if (response) {
      this._capabilities = {
        ...this._capabilities,
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
    this._fireFakeContinued(args.threadId);
    return this.send('next', args);
  }

  stepIn(
    args: DebugProtocol.StepInArguments,
  ): Promise<DebugProtocol.StepInResponse> {
    this._fireFakeContinued(args.threadId);
    return this.send('stepIn', args);
  }

  stepOut(
    args: DebugProtocol.StepOutArguments,
  ): Promise<DebugProtocol.StepOutResponse> {
    this._fireFakeContinued(args.threadId);
    return this.send('stepOut', args);
  }

  continue(
    args: DebugProtocol.ContinueArguments,
  ): Promise<DebugProtocol.ContinueResponse> {
    this._fireFakeContinued(args.threadId);
    return this.send('continue', args);
  }

  pause(
    args: DebugProtocol.PauseArguments,
  ): Promise<DebugProtocol.PauseResponse> {
    return this.send('pause', args);
  }

  setVariable(
    args: DebugProtocol.SetVariableArguments,
  ): Promise<DebugProtocol.SetVariableResponse> {
    return this.send('setVariable', args);
  }

  restartFrame(
    args: DebugProtocol.RestartFrameArguments,
    threadId: number,
  ): Promise<DebugProtocol.RestartFrameResponse> {
    this._fireFakeContinued(threadId);
    return this.send('restartFrame', args);
  }

  completions(
    args: DebugProtocol.CompletionsArguments,
  ): Promise<DebugProtocol.CompletionsResponse> {
    return this.send('completions', args);
  }

  async disconnect(
    restart: boolean = false,
    force: boolean = false,
  ): Promise<void> {
    if (this._disconnected && force) {
      this._stopServer();
      return;
    }

    if (this._serverProcess && !this._disconnected) {
      // point of no return: from now on don't report any errors
      this._disconnected = true;
      await this.send('disconnect', {restart});
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
    return this.send('evaluate', args);
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
    this._fireFakeContinued(args.threadId);
    return this.send('reverseContinue', args);
  }

  nuclide_continueToLocation(
    args: DebugProtocol.nuclide_ContinueToLocationArguments,
  ): Promise<DebugProtocol.nuclide_ContinueToLocationResponse> {
    return this.custom('nuclide_continueToLocation', args);
  }

  getLengthInSeconds(): number {
    return (new Date().getTime() - this._startTime) / 1000;
  }

  dispatchRequest(
    request: DebugProtocol.Request,
    response: DebugProtocol.Response,
  ): void {
    if (request.command === 'runInTerminal') {
      this._logger.error('TODO: runInTerminal', request);
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
      // $FlowFixMe
      body: {
        threadId,
        allThreadsContinued,
      },
      seq: 0,
    };
    this._onDidContinued.next(event);
    this._onDidEvent.next(event);
  }

  async _startServer(): Promise<void> {
    const {command, args} = this._adapterExecutable;
    const options = {
      stdio: [
        'pipe', // stdin
        'pipe', // stdout
        'pipe', // stderr
      ],
      // RN debugger can't be used in `production` environment.
      // NODE_ENV: 'development',
      env: await getOriginalEnvironment(),
    };
    const serverProcess = (this._serverProcess = child_process.spawn(
      command,
      args,
      options,
    ));
    // Process and stream errors shouldn't crash the server.
    preventStreamsFromThrowing(serverProcess);
    logStreamErrors(serverProcess, command, args, options);

    serverProcess.on('error', (err: Error) => this.onServerError(err));
    serverProcess.on('exit', (code: number, signal: string) =>
      this.onServerExit(code),
    );

    serverProcess.stderr.on('data', (data: string) => {
      const event: DebugProtocol.OutputEvent = ({
        type: 'event',
        event: 'output',
        body: {
          category: 'stderr',
          output: data.toString(),
        },
        seq: 0,
      }: any);
      this._onDidOutput.next(event);
      this._onDidEvent.next(event);
      this._logger.error(`adapter stderr: ${data.toString()}`);
    });

    this.connect(serverProcess.stdout, serverProcess.stdin);
  }

  _stopServer(): void {
    this.onEvent(raiseAdapterExitedEvent(0));
    if (this._serverProcess == null) {
      return;
    }

    this._disconnected = true;
    killProcess(this._serverProcess, /* killTree */ true);
  }

  onServerError(error: Error): void {
    this._logger.error('Adapter error:', error);
    this._stopServer();
  }

  onServerExit(code: number): void {
    this._serverProcess = null;
    this._cachedInitServer = null;
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

  dispose(): void {
    this.disconnect();
  }
}
