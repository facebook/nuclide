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

import type {ITerminal} from 'nuclide-prebuilt-libs/pty';
import type {MIStoppedEventResult} from './MITypes';

import {
  BreakpointEvent,
  logger,
  Logger,
  LoggingDebugSession,
  InitializedEvent,
  OutputEvent,
  StoppedEvent,
  TerminatedEvent,
  ThreadEvent,
} from 'vscode-debugadapter';
import Breakpoints from './Breakpoints';
import SourceBreakpoints from './SourceBreakpoints';
import * as DebugProtocol from 'vscode-debugprotocol';
import Disassemble from './Disassemble';
import ExceptionBreakpoints from './ExceptionBreakpoints';
import FunctionBreakpoints from './FunctionBreakpoints';
import invariant from 'assert';
import MIProxy from './MIProxy';
import {MIAsyncRecord, MIResultRecord, MIStreamRecord} from './MIRecord';
import * as pty from 'nuclide-prebuilt-libs/pty';
import os from 'os';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {
  breakpointModifiedEventResult,
  stoppedEventResult,
  toCommandError,
  threadInfoResult,
} from './MITypes';
import StackFrames from './StackFrames';
import Variables from './Variables';
import {debugSymSizeByProcess, debugSymSizeByBinary} from './DebugSymbolsSize';
import {logVerbose} from './Logger';

// NB that trace is not actually exposed in package.json as it's only used for
// debugging the adapter itself
type LaunchRequestArguments = {
  ...DebugProtocol.LaunchRequestArguments,
  program: string,
  cwd: ?string,
  args: ?Array<string>,
  env: Array<string>,
  sourcePath: string,
  sourcePaths: Array<string>,
  trace: ?boolean,
};

type AttachRequestArguments = {
  ...DebugProtocol.AttachRequestArguments,
  pid: number,
  sourcePath: string,
  sourcePaths: Array<string>,
  stopOnAttach: ?boolean,
  trace: ?boolean,
};

class MIDebugSession extends LoggingDebugSession {
  _hasTarget: boolean;
  _configurationDone: boolean;
  _client: MIProxy;
  _breakpoints: Breakpoints;
  _sourceBreakpoints: SourceBreakpoints;
  _functionBreakpoints: FunctionBreakpoints;
  _disassemble: Disassemble;
  _exceptionBreakpoints: ExceptionBreakpoints;
  _stackFrames: StackFrames;
  _variables: Variables;
  _targetIO: ?ITerminal;
  _asyncHandlers: Map<string, (record: MIAsyncRecord) => void>;
  _attachPID: ?number;
  _running: boolean;
  _expectingPause: boolean;
  _pauseQueue: Array<() => Promise<void>>;
  _continueOnAttach: boolean;
  _stepping: boolean;
  _steppingThread: number = 0;
  _configurationDoneResponse: ?DebugProtocol.ConfigurationDoneResponse;

  constructor() {
    const logfile = nuclideUri.join(os.tmpdir(), 'native-debugger-vsp.log');
    super(logfile);
    this._hasTarget = false;
    this._configurationDone = false;

    const client = new MIProxy();
    this._client = client;

    this._breakpoints = new Breakpoints();
    this._sourceBreakpoints = new SourceBreakpoints(client, this._breakpoints);
    this._functionBreakpoints = new FunctionBreakpoints(
      client,
      this._breakpoints,
    );
    this._exceptionBreakpoints = new ExceptionBreakpoints(client);
    this._stackFrames = new StackFrames(client);
    this._disassemble = new Disassemble(client, this._stackFrames);
    this._variables = new Variables(client, this._stackFrames);
    this._expectingPause = false;
    this._continueOnAttach = false;

    client.on('error', err => {
      logVerbose(`proxy has exited with error ${err}`);
      this._hasTarget = false;
      this._configurationDone = false;
    });

    client.on('exit', () => {
      logVerbose('proxy has exited cleanly');
      this._hasTarget = false;
      this._configurationDone = false;
    });

    client.on('async', record => this._asyncRecord(record));
    client.on('stream', record => this._streamRecord(record));

    this._asyncHandlers = new Map([
      [
        'stopped',
        record => {
          this._onAsyncStopped(record);
        },
      ],
      ['thread-created', record => this._onAsyncThread(record, true)],
      ['thread-exited', record => this._onAsyncThread(record, false)],
      ['breakpoint-modified', record => this._onBreakpointModified(record)],
    ]);

    this._pauseQueue = [];
  }

  _asyncRecord(record: MIAsyncRecord): void {
    const handler = this._asyncHandlers.get(record.asyncClass);
    if (handler != null) {
      handler(record);
    }
  }

  _discardMessage(msg: string): boolean {
    // remove hint about fbload since it doesn't directly work from here
    if (msg.indexOf('fbload') !== -1) {
      return true;
    }

    // remove messages about stopping, because (a) sometimes we stop and
    // resume silently and the user shouldn't care, and (b) debuggers
    // print there own stop messages
    //
    // Program received signal SIGINT, Interrupt.
    // 0x00007ffff7ad3550 in __nanosleep_nocancel () from /lib64/libc.so.6

    // '\nProgram' and ' received signal' come in as two separate events
    if (
      msg === '\nProgram' ||
      msg.startsWith(' received signal') ||
      /^0x[0-9a-f]+ in.*from.*/.test(msg)
    ) {
      return true;
    }

    return false;
  }

  _streamRecord(record: MIStreamRecord): void {
    // NB we never get target output here, that's handled by the pty. The
    // output here is mainly from raw pass-through gdb commands.
    if (
      (record.streamTarget === 'console' || record.streamTarget === 'log') &&
      !this._discardMessage(record.text)
    ) {
      const event = new OutputEvent();
      event.body = {
        category: 'log',
        data: {
          type: record.streamTarget === 'console' ? 'success' : 'log',
        },
        output: record.text,
      };

      this.sendEvent(event);
    }
  }

  start(inStream: ReadableStream, outStream: WritableStream): void {
    super.start(inStream, outStream);
    logVerbose(`using node ${process.version} at ${process.execPath}`);
  }

  initializeRequest(
    response: DebugProtocol.InitializeResponse,
    args: DebugProtocol.InitializeRequestArguments,
  ): void {
    response.body = response.body || {};
    response.body.supportsFunctionBreakpoints = true;
    response.body.supportsConfigurationDoneRequest = true;
    response.body.supportsSetVariable = true;
    response.body.supportsValueFormattingOptions = true;
    response.body.supportsBreakpointIdOnStop = true;
    response.body.exceptionBreakpointFilters = [
      {
        filter: 'uncaught',
        label: 'Uncaught exceptions',
        default: false,
      },
      {
        filter: 'thrown',
        label: 'Thrown exceptions',
        default: false,
      },
    ];

    this.sendResponse(response);

    // sequencing: after this, we will get breakpoint requests, eventually followed by a configurationDoneRequest.
    // notably we will get a launchRequest *before* configuration done, and actually before the breakpoint
    // requests. so we have to be careful to bring up the debugger in the launch request, then set the
    // initial breakpoints, and not actually start the program until configuration done.
    this.sendEvent(new InitializedEvent());
  }

  async launchRequest(
    response: DebugProtocol.LaunchResponse,
    args: LaunchRequestArguments,
  ): Promise<void> {
    logger.setup(
      args.trace === true ? Logger.LogLevel.Verbose : Logger.LogLevel.Error,
      true,
    );

    let environment = {};
    if (args.env != null) {
      args.env.forEach(_ => {
        const equal = _.indexOf('=');
        if (equal === -1) {
          throw new Error('Given environment is malformed.');
        }
        const key = _.substr(0, equal);
        const value = _.substr(equal + 1);
        environment = {
          ...environment,
          [key]: value,
        };
      });
    }

    this._client.start('gdb', ['-q', '--interpreter=mi2'], environment);
    if (!(await this._setSourcePaths(response, args))) {
      return;
    }

    if (
      args.cwd != null &&
      args.cwd.trim() !== '' &&
      !(await this._sendWithFailureCheck(
        response,
        `environment-cd ${args.cwd}`,
      ))
    ) {
      return;
    }

    if (
      args.args != null &&
      !(await this._sendWithFailureCheck(
        response,
        `exec-arguments ${args.args.join(' ')}`,
      ))
    ) {
      return;
    }

    this._showSymbolLoadingSizeWarning(
      await debugSymSizeByBinary(args.program),
    );

    if (
      !(await this._sendWithFailureCheck(
        response,
        `file-exec-and-symbols ${args.program}`,
      ))
    ) {
      return;
    }

    await this._warnIfNoSymbols(args.program);

    this._attachPID = null;

    this._hasTarget = true;
    this.sendResponse(response);
  }

  async attachRequest(
    response: DebugProtocol.AttachResponse,
    args: AttachRequestArguments,
  ): Promise<void> {
    logger.setup(
      args.trace === true ? Logger.LogLevel.Verbose : Logger.LogLevel.Error,
      true,
    );

    this._client.start('gdb', ['-q', '--interpreter=mi2'], null);

    if (!this._setSourcePaths(response, args)) {
      return;
    }

    if (args.pid == null) {
      this._sendFailureResponse(
        response,
        'to attach, process id must be given',
      );
    }

    this._attachPID = args.pid;
    this._continueOnAttach = args.stopOnAttach !== true;

    this._hasTarget = true;
    this.sendResponse(response);
  }

  async _setSourcePaths(
    response: DebugProtocol.Response,
    args: LaunchRequestArguments | AttachRequestArguments,
  ): Promise<boolean> {
    let sourcePaths: Array<string> = [];
    if (args.sourcePaths != null) {
      sourcePaths = args.sourcePaths;
    } else if (args.sourcePath != null && args.sourcePath.trim() !== '') {
      sourcePaths = [args.sourcePath];
    }

    if (sourcePaths.length !== 0) {
      const quotedPathList = sourcePaths.map(path => `"${path}"`).join(' ');
      const command = `environment-directory -r ${quotedPathList}`;
      this._logToConsole(`Setting source paths with "${command}"\n`);
      if (!(await this._sendWithFailureCheck(response, command))) {
        return false;
      }
    }

    return true;
  }

  async disconnectRequest(
    response: DebugProtocol.DisconnectResponse,
    request: DebugProtocol.DisconnectRequest,
  ): Promise<void> {
    this._stepping = false;
    this._steppingThread = 0;
    this._runWhenStopped(async () => {
      if (this._attachPID != null) {
        await this._client.sendCommand('target-detach');
        this._attachPID = null;
        this._hasTarget = false;
      }
      this.sendResponse(response);
    });
  }

  async configurationDoneRequest(
    response: DebugProtocol.ConfigurationDoneResponse,
    args: DebugProtocol.ConfigurationDoneArguments,
  ): Promise<void> {
    this._configurationDone = true;

    if (!(await this._initializeTargetIO(response))) {
      return;
    }

    await this._sendCachedBreakpoints();

    this._running = true;

    const pid = this._attachPID;
    if (pid != null) {
      this._showSymbolLoadingSizeWarning(await debugSymSizeByProcess(pid));

      if (
        !(await this._sendWithFailureCheck(response, `target-attach ${pid}`))
      ) {
        return;
      }

      await this._warnIfNoSymbols(`process ${pid.toString(10)}`);

      // target-attach returns done very quickly, but isn't really done until
      // the corresponding *stopped event happens.
      this._configurationDoneResponse = response;
    } else {
      if (!(await this._sendWithFailureCheck(response, 'exec-run'))) {
        return;
      }
      this.sendResponse(response);
    }
  }

  async _showSymbolLoadingSizeWarning(size: ?number): Promise<void> {
    if (size == null) {
      // generic "this operation can be slow" message since we don't know how
      // large they are. Since we're not sure if this is really an issue,
      // just log to console.
      this._logToConsole(
        'Reading executable symbols (for huge executables, this can take up to 2-3 minutes).\n',
      );
      return;
    }

    // Attempt to show an order of magnitude guess as to how long loading might
    // take. If we know for sure the symbols are big, show an actual warning dialog

    // very rough estimate that 100M is where things start taking more than a
    // few seconds
    const ONE_MEG = 1024 * 1024;
    const SYMBOL_SIZE_LIMIT = 100 * ONE_MEG;

    // over a gig you're going to be here a while
    const ONE_GIG = 1024 * 1024 * 1024;
    const HUGE_SYMBOL_SIZE_LIMIT = ONE_GIG;

    if (size > HUGE_SYMBOL_SIZE_LIMIT) {
      return this._nuclideWarningDialog(
        `The symbols for your executable are very large (${(
          size / ONE_GIG
        ).toFixed(2)}G). Loading them may take several minutes.`,
      );
    }

    if (size > SYMBOL_SIZE_LIMIT) {
      return this._nuclideWarningDialog(
        `The symbols for your executable are fairly large (${(
          size / ONE_MEG
        ).toFixed(2)}M). It may take up to a minute to load them.`,
      );
    }
  }

  async setBreakPointsRequest(
    response: DebugProtocol.SetBreakpointsResponse,
    args: DebugProtocol.SetBreakpointsArguments,
  ): Promise<void> {
    this._runWhenStopped(async () => {
      try {
        const source =
          args.source.path != null ? args.source.path : args.source.name;
        invariant(source != null);

        const breakpoints = args.breakpoints;
        if (breakpoints == null) {
          this._sendFailureResponse(
            response,
            'No breakpoints specified in breakpoints request',
          );
          return;
        }

        const protocolBreakpoints = await this._sourceBreakpoints.setSourceBreakpoints(
          source,
          breakpoints,
        );

        response.body = {
          breakpoints: protocolBreakpoints,
        };

        this.sendResponse(response);
      } catch (error) {
        this._sendFailureResponse(response, error.message);
      }
    });
  }

  async setFunctionBreakPointsRequest(
    response: DebugProtocol.SetFunctionBreakpointsResponse,
    args: DebugProtocol.SetFunctionBreakpointsArguments,
  ): Promise<void> {
    this._runWhenStopped(async () => {
      try {
        const breakpoints = args.breakpoints;
        if (breakpoints == null) {
          this._sendFailureResponse(
            response,
            'No breakpoints specified in breakpoints request',
          );
          return;
        }

        const functions = breakpoints.map(_ => _.name);
        const breakpointsOut = await this._functionBreakpoints.setFunctionBreakpoints(
          functions,
        );

        response.body = {
          breakpoints: breakpointsOut,
        };

        this.sendResponse(response);
      } catch (error) {
        this._sendFailureResponse(response, error.message);
      }
    });
  }

  async _sendCachedBreakpoints(): Promise<void> {
    logVerbose('_sendCachedBreakpoints');
    const changedBreakpoints = [
      ...(await this._sourceBreakpoints.setCachedBreakpoints()),
      ...(await this._functionBreakpoints.setCachedBreakpoints()),
    ];

    changedBreakpoints.forEach(breakpoint => {
      const event = new BreakpointEvent();
      event.body = {
        reason: 'changed',
        breakpoint,
      };

      this.sendEvent(event);
    });
  }

  async setExceptionBreakPointsRequest(
    response: DebugProtocol.SetExceptionBreakpointsResponse,
    args: DebugProtocol.SetExceptionBreakpointsArguments,
  ): Promise<void> {
    try {
      await this._exceptionBreakpoints.setExceptionBreakpointFilters(
        args.filters,
      );
      this.sendResponse(response);
    } catch (error) {
      this._sendFailureResponse(response, error.message);
    }
  }

  async threadsRequest(response: DebugProtocol.ThreadsResponse): Promise<void> {
    this._runWhenStopped(async () => {
      const threadRecord: MIResultRecord = await this._client.sendCommand(
        'thread-info',
      );

      try {
        if (!threadRecord.done) {
          this._sendFailureResponse(response, 'Failed to retrieve threads');
          return;
        }

        const threads = threadInfoResult(threadRecord).threads;

        response.body = {
          threads: threads.map(_ => {
            return {
              id: parseInt(_.id, 10),
              name: _['target-id'],
            };
          }),
        };

        this.sendResponse(response);
      } catch (err) {
        this._sendFailureResponse(response, err.message);
      }
    });
  }

  async stackTraceRequest(
    response: DebugProtocol.StackTraceResponse,
    args: DebugProtocol.StackTraceArguments,
  ): Promise<void> {
    await this._setOutputFormat(
      args.format != null && args.format.hex != null && args.format.hex,
    );

    response.body = await this._stackFrames.stackFramesForThread(
      args.threadId,
      args.startFrame,
      args.levels,
    );

    try {
      response.body.stackFrames = await Promise.all(
        response.body.stackFrames.map(async frame => {
          let source = frame.source;
          if (source == null || source.path == null) {
            source = {
              sourceReference: await this._disassemble.sourceReferenceForStackFrame(
                frame.id,
              ),
            };
          }
          return {
            ...frame,
            source,
          };
        }),
      );

      this.sendResponse(response);
    } catch (err) {
      this._sendFailureResponse(response, err.message);
    }
  }

  async sourceRequest(
    response: DebugProtocol.SourceResponse,
    args: DebugProtocol.SourceArguments,
  ): Promise<void> {
    try {
      const content = await this._disassemble.getDisassembly(
        args.sourceReference,
      );
      response.body = {content};
      this.sendResponse(response);
    } catch (err) {
      this._sendFailureResponse(response, err.message);
    }
  }

  async pauseRequest(
    response: DebugProtocol.PauseResponse,
    args: DebugProtocol.PauseArguments,
  ): Promise<void> {
    try {
      this._expectingPause = true;
      this._client.pause();
      this.sendResponse(response);
    } catch (err) {
      this._sendFailureResponse(response, err.message);
    }
  }

  async continueRequest(
    response: DebugProtocol.ContinueResponse,
    args: DebugProtocol.ContinueRequest,
  ): Promise<void> {
    return this._executeCommon('exec-continue', null, response);
  }

  async nextRequest(
    response: DebugProtocol.NextResponse,
    args: DebugProtocol.NextArguments,
  ): Promise<void> {
    this._stepping = true;
    this._steppingThread = args.threadId;
    return this._executeCommon('exec-next', args.threadId, response);
  }

  async stepInRequest(
    response: DebugProtocol.StepInResponse,
    args: DebugProtocol.StepInArguments,
  ): Promise<void> {
    this._stepping = true;
    this._steppingThread = args.threadId;
    return this._executeCommon('exec-step', args.threadId, response);
  }

  async stepOutRequest(
    response: DebugProtocol.StepOutResponse,
    args: DebugProtocol.StepOutArguments,
  ): Promise<void> {
    this._stepping = true;
    this._steppingThread = args.threadId;
    return this._executeCommon('exec-finish', args.threadId, response);
  }

  async _executeCommon(
    execCommand: string,
    threadId: ?number,
    response: DebugProtocol.Response,
  ): Promise<void> {
    try {
      const thread = threadId != null ? `--thread ${threadId}` : '';
      const result = await this._client.sendCommand(`${execCommand} ${thread}`);
      if (!result.running) {
        this._sendFailureResponse(
          response,
          `Failed to ${execCommand} program ${toCommandError(result).msg}`,
        );
        return;
      }

      this._running = true;
      this.sendResponse(response);
    } catch (err) {
      this._sendFailureResponse(response, err.message);
    }
  }

  async scopesRequest(
    response: DebugProtocol.ScopesResponse,
    args: DebugProtocol.ScopesArguments,
  ): Promise<void> {
    try {
      const varref = this._variables.variableReferenceForStackFrame(
        args.frameId,
      );

      const scopes = [
        {
          name: 'Locals',
          variablesReference: varref,
          expensive: false,
        },
      ];

      const regVarref = await this._variables.registersVariableReference();
      if (regVarref != null) {
        scopes.push({
          name: 'Registers',
          variablesReference: regVarref,
          expensive: false,
        });
      }

      response.body = {scopes};
      this.sendResponse(response);
    } catch (err) {
      this._sendFailureResponse(response, err.message);
    }
  }

  async variablesRequest(
    response: DebugProtocol.VariablesResponse,
    args: DebugProtocol.VariablesArguments,
  ): Promise<void> {
    await this._setOutputFormat(
      args.format != null && args.format.hex != null && args.format.hex,
    );

    try {
      const variables = await this._variables.getVariables(
        args.variablesReference,
        args.start,
        args.count,
      );

      response.body = {variables};

      this.sendResponse(response);
    } catch (err) {
      this._sendFailureResponse(response, err.message);
    }
  }

  async setVariableRequest(
    response: DebugProtocol.SetVariableResponse,
    args: DebugProtocol.SetVariableArguments,
  ): Promise<void> {
    await this._setOutputFormat(
      args.format != null && args.format.hex != null && args.format.hex,
    );

    try {
      const varref = this._variables.getVariableReference(
        args.variablesReference,
      );
      if (varref == null) {
        throw new Error(
          `setVariableRequest: invalid variable reference ${
            args.variablesReference
          }`,
        );
      }

      const varSet = await varref.setChildValue(args.name, args.value);

      response.body = varSet;
      this.sendResponse(response);
    } catch (err) {
      this._sendFailureResponse(response, err.message);
    }
  }

  async evaluateRequest(
    response: DebugProtocol.EvaluateResponse,
    args: DebugProtocol.EvaluateArguments,
  ): Promise<void> {
    // Hack to allow raw gdb commands from the console.
    if (args.expression.startsWith('`')) {
      return this._escapedCommandRequest(response, args.expression.substr(1));
    }

    await this._setOutputFormat(
      args.format != null && args.format.hex != null && args.format.hex,
    );

    try {
      let threadId: ?number;
      let frameIndex: ?number;

      const frameId = args.frameId;
      if (frameId != null) {
        const stackFrame = this._stackFrames.stackFrameByHandle(frameId);
        if (stackFrame == null) {
          throw new Error(`evaluateRequest passed invalid frameId ${frameId}`);
        }
        threadId = stackFrame.threadId;
        frameIndex = stackFrame.frameIndex;
      }

      const handle = this._variables.expressionVariableReference(
        threadId,
        frameIndex,
        args.expression,
      );

      const variables = await this._variables.getVariables(handle);
      invariant(
        variables.length === 1,
        'call should return 1 element or throw on error',
      );
      const variable = variables[0];

      response.body = {
        result: variable.value,
        type: variable.type,
        variablesReference: variable.variablesReference,
        namedVariables: variable.namedVariables,
        indexedVariables: variable.indexedVariables,
      };

      this.sendResponse(response);
    } catch (err) {
      this._sendFailureResponse(response, err.message);
    }
  }

  async _escapedCommandRequest(
    response: DebugProtocol.EvaluateResponse,
    command: string,
  ): Promise<void> {
    try {
      if (this._running) {
        this._logToConsole(
          'gdb commands may only be issued when the target is stopped.\n',
        );
        this._sendFailureResponse(response, 'failed');
        return;
      }

      await this._client.sendRawCommand(command);

      response.body = {
        result: '',
        type: 'void',
        variablesReference: 0,
      };

      this.sendResponse(response);
    } catch (err) {
      this._sendFailureResponse(response, err.message);
    }
  }

  async _setOutputFormat(hex: boolean): Promise<void> {
    this._client.sendCommand(`gdb-set output-radix ${hex ? 16 : 10}`);
  }

  async _initializeTargetIO(
    response: DebugProtocol.ConfigurationDoneResponse,
  ): Promise<boolean> {
    // $TODO Windows

    // gdb uses a pty to pipe target (what it calls inferior) output separately from
    // MI traffic. set up a pty and handlers.
    const targetIO = pty.open({});
    this._targetIO = targetIO;
    targetIO.on('data', line => this._onTargetIO(line));

    // if the pty socket sends 'end' it means the target process has terminated.
    targetIO.once('end', () => this._onTargetTerminated());

    // if there's an error such as the actual debugger crashing, shut down cleanly
    targetIO.once('error', () => this._onTargetTerminated());

    if (
      !(await this._sendWithFailureCheck(
        response,
        `inferior-tty-set ${targetIO.ptyName}`,
      ))
    ) {
      return false;
    }

    return true;
  }

  _onTargetIO(line: string): void {
    const event = new OutputEvent();
    event.body = {
      category: 'stdout',
      output: line,
    };

    this.sendEvent(event);
  }

  _onTargetTerminated(): void {
    this.sendEvent(new TerminatedEvent());
    this._hasTarget = false;
    this._configurationDone = false;
  }

  async _runWhenStopped(fn: () => Promise<void>): Promise<void> {
    if (!this._running) {
      return fn();
    }

    this._pauseQueue.push(fn);

    if (this._stepping) {
      // If we are stepping, then sending a signal and then continuing will
      // disrupt the step. We're going to stop anyway, so just don't.
      return;
    }

    if (this._pauseQueue.length === 1) {
      // NB there is a race condition in gdb where if you send a SIGINT too soon
      // after the target is changed from stopped to running, it doesn't send another
      // stopped event. This really should be a throttle, not done every time.
      setTimeout(() => {
        // prevent the normal logging of messages about SIGINT, which are just
        // confusing since the user won't know why we're stopping
        this._client.pause();
      }, 125);
    }
  }

  async _processPauseQueue(): Promise<void> {
    const fns = this._pauseQueue.slice();
    this._pauseQueue = [];
    await Promise.all(fns.map(fn => fn()));
  }

  _pauseIfThereAreQueuedCommands(): void {
    if (this._pauseQueue.length !== 0) {
      this._client.pause();
    }
  }

  _breakpointIdFromStop(stop: MIStoppedEventResult): ?number {
    const bkptno = stop.bkptno;
    if (bkptno == null) {
      return null;
    }

    const bkptid = parseInt(bkptno, 10);
    if (isNaN(bkptid)) {
      return null;
    }

    const bp = this._breakpoints.breakpointByDebuggerId(bkptid);
    if (bp == null) {
      return null;
    }

    return this._breakpoints.handleForBreakpoint(bp);
  }

  async _onAsyncStopped(record: MIAsyncRecord): Promise<void> {
    const stopped = stoppedEventResult(record);

    await this._processPauseQueue();

    // if we're stepping and we get a signal in the stepping thread, then
    // we shouldn't ignore the signal, even if exception breakpoints aren't
    // enabled
    const signalWhileStepping =
      this._stepping &&
      stopped.reason === 'signal-received' &&
      stopped['thread-id'] === this._steppingThread;

    // A received signal means one of two things: SIGINT sent to gdb to drop
    // into command mode (pausing the target), or an unexpected signal which
    // is an exception to break on.
    if (
      !this._expectingPause &&
      this._exceptionBreakpoints.shouldIgnoreBreakpoint(stopped) &&
      !signalWhileStepping
    ) {
      this._running = true;
      await this._client.sendCommand('exec-continue');
      // we are really running again. if any commands came in from the UI during
      // the await here, they will have been queued. if we don't check now,
      // we could drop them. pausing again will cause them to run.
      this._pauseIfThereAreQueuedCommands();
      return;
    }

    this._running = false;
    this._stackFrames.clearCachedFrames();
    this._variables.clearCachedVariables();

    // Values: 'step', 'breakpoint', 'exception', 'pause', 'entry', etc.

    let reason = 'pause';
    let description = 'Execution paused';
    let breakpointId: ?number = null;

    const exceptionReason = this._exceptionBreakpoints.stopEventReason(stopped);
    if (exceptionReason != null) {
      reason = exceptionReason.reason;
      description = exceptionReason.description;
    } else if (stopped.reason === 'breakpoint-hit') {
      reason = 'breakpoint';
      description = 'Breakpoint hit';
      breakpointId = this._breakpointIdFromStop(stopped);
    } else if (stopped.reason === 'end-stepping-range') {
      reason = 'step';
      description = 'Execution stepped';
      this._stepping = false;
      this._steppingThread = 0;
    } else if (stopped.reason === 'exited') {
      this._onTargetTerminated();
      return;
    } else if (stopped.reason === 'signal-received') {
      this._expectingPause = false;
    } else if (
      stopped.reason === 'exited-normally' ||
      stopped.reason === 'exited-signalled'
    ) {
      this._onTargetTerminated();
      return;
    } else if (stopped.reason == null) {
      // the stop reason is empty for attach start
      if (this._configurationDoneResponse != null) {
        this.sendResponse(this._configurationDoneResponse);
        this._configurationDoneResponse = null;
      }

      if (this._continueOnAttach) {
        this._continueOnAttach = false;
        this._running = true;
        await this._client.sendCommand('exec-continue');
        return;
      }
    }

    const event = new StoppedEvent();
    event.body = {
      reason,
      description,
      breakpointId,
      threadId: parseInt(stopped['thread-id'], 10),
      preserveFocusHint: false,
      allThreadsStopped: true,
    };

    this.sendEvent(event);
  }

  _onAsyncThread(record: MIAsyncRecord, started: boolean): void {
    // NB that using a handle table is not needed for threads, because the MI
    // interface defines a thread id which is exactly the same thing.
    const id = record.result.id;
    const event = new ThreadEvent();

    event.body = {
      reason: started ? 'started' : 'exited',
      threadId: parseInt(id, 10),
    };

    this.sendEvent(event);
  }

  async _warnIfNoSymbols(program: string): Promise<void> {
    const result = await this._client.sendCommand('file-list-exec-source-file');
    if (
      result.error &&
      toCommandError(result).msg.startsWith('No symbol table')
    ) {
      return this._nuclideWarningDialog(
        `Symbols were not found in ${program}. It will run, but breakpoints will not work. Please recompile your program with the proper flags to include debugging symbols (typically -g).`,
      );
    }
  }

  async _sendWithFailureCheck(
    response: DebugProtocol.Response,
    command: string,
  ): Promise<boolean> {
    const result = await this._client.sendCommand(command);
    if (result.error) {
      this._sendFailureResponse(response, toCommandError(result).msg);
      return false;
    }
    return true;
  }

  async _nuclideWarningDialog(output: string): Promise<void> {
    const event = new OutputEvent();
    event.body = {
      category: 'nuclide_notification',
      data: {
        type: 'warning',
      },
      output,
    };

    return this.sendEvent(event);
  }

  async _logToConsole(output: string): Promise<void> {
    const event = new OutputEvent();
    event.body = {
      category: 'stdout',
      data: {
        type: 'warning',
      },
      output,
    };

    return this.sendEvent(event);
  }

  _onBreakpointModified(record: MIAsyncRecord): void {
    const result = breakpointModifiedEventResult(record);
    const breakpoint = this._breakpoints.breakpointByDebuggerId(
      parseInt(result.bkpt[0].number, 10),
    );

    if (breakpoint != null && !breakpoint.verified) {
      const handle = this._breakpoints.handleForBreakpoint(breakpoint);
      invariant(handle != null);

      breakpoint.setVerified();

      const protocolBreakpoint = {
        id: handle,
        verified: true,
        source: {
          source: breakpoint.source,
        },
        line: breakpoint.line,
      };

      const event = new BreakpointEvent();
      event.body = {
        reason: 'changed',
        breakpoint: protocolBreakpoint,
      };

      this.sendEvent(event);
    }
  }

  _sendFailureResponse(
    response: DebugProtocol.Response,
    message?: string,
  ): void {
    response.success = false;
    response.message = message;
    this.sendResponse(response);
  }
}

LoggingDebugSession.run(MIDebugSession);
