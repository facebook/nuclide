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

/**
 * The following interfaces models a debug service and data model layer built on top of
 * VSCode debugger protocol and were modeled after VSCode's debugger implementation
 * in https://github.com/Microsoft/vscode/tree/master/src/vs/workbench/parts/debug

MIT License

Copyright (c) 2015 - present Microsoft Corporation

All rights reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import type {Expected} from 'nuclide-commons/expected';
import type {Observable} from 'rxjs';
import * as DebugProtocol from 'vscode-debugprotocol';
import type {IProcessConfig} from 'nuclide-debugger-common';

export interface RemoteDebuggerService {
  onDidChangeDebuggerSessions(
    callback: (sessionConfigs: IProcessConfig[]) => mixed,
  ): IDisposable;
  startVspDebugging(config: IProcessConfig): Promise<void>;
  getDebugSessions(): IProcessConfig[];
}

export interface ITreeElement {
  getId(): string;
}

export interface ISource {
  available: boolean;
  +name: ?string;
  +uri: string;
  +origin: ?string;
  +presentationHint: ?SourcePresentationHint;
  +raw: DebugProtocol.Source;
  +reference: ?number;
  +inMemory: boolean;
  openInEditor(): Promise<atom$TextEditor>;
}

export type SourcePresentationHint = 'normal' | 'emphasize' | 'deemphasize';

export interface IExpressionContainer extends ITreeElement {
  hasChildren(): boolean;
  getChildren(): Promise<Array<IVariable>>;
}

export interface IExpression extends IExpressionContainer {
  available: boolean;
  name: string;
  getValue(): string;
  +type: ?string;
  toString(): string;
}

export type ContextType = 'hover' | 'watch' | 'repl';

export interface IEvaluatableExpression extends IExpression {
  evaluate(
    process: ?IProcess,
    stackFrame: ?IStackFrame,
    context: ContextType,
  ): Promise<void>;
}

export interface IVariable extends IExpression {
  canSetVariable(): boolean;
  setVariable(newValue: string): Promise<void>;
  +grammarName: ?string;
}

export interface ISession {
  stackTrace(
    args: DebugProtocol.StackTraceArguments,
  ): Promise<DebugProtocol.StackTraceResponse>;
  exceptionInfo(
    args: DebugProtocol.ExceptionInfoArguments,
  ): Promise<DebugProtocol.ExceptionInfoResponse>;
  scopes(
    args: DebugProtocol.ScopesArguments,
  ): Promise<DebugProtocol.ScopesResponse>;
  variables(
    args: DebugProtocol.VariablesArguments,
  ): Promise<DebugProtocol.VariablesResponse>;
  evaluate(
    args: DebugProtocol.EvaluateArguments,
  ): Promise<DebugProtocol.EvaluateResponse>;
  capabilities: DebugProtocol.Capabilities;
  disconnect(restart?: boolean, force?: boolean): Promise<void>;
  custom(request: string, args: any): Promise<DebugProtocol.CustomResponse>;
  observeInitializeEvents(): Observable<DebugProtocol.InitializedEvent>;
  observeCustomEvents(): Observable<DebugProtocol.DebugEvent>;
  observeStopEvents(): Observable<DebugProtocol.StoppedEvent>;
  restartFrame(
    args: DebugProtocol.RestartFrameArguments,
    threadId: number,
  ): Promise<DebugProtocol.RestartFrameResponse>;
  next(args: DebugProtocol.NextArguments): Promise<DebugProtocol.NextResponse>;
  stepIn(
    args: DebugProtocol.StepInArguments,
  ): Promise<DebugProtocol.StepInResponse>;
  stepOut(
    args: DebugProtocol.StepOutArguments,
  ): Promise<DebugProtocol.StepOutResponse>;
  continue(
    args: DebugProtocol.ContinueArguments,
  ): Promise<DebugProtocol.ContinueResponse>;
  pause(
    args: DebugProtocol.PauseArguments,
  ): Promise<DebugProtocol.PauseResponse>;
  stepBack(
    args: DebugProtocol.StepBackArguments,
  ): Promise<DebugProtocol.StepBackResponse>;
  reverseContinue(
    args: DebugProtocol.ReverseContinueArguments,
  ): Promise<DebugProtocol.ReverseContinueResponse>;
  completions(
    args: DebugProtocol.CompletionsArguments,
  ): Promise<DebugProtocol.CompletionsResponse>;
  setVariable(
    args: DebugProtocol.SetVariableArguments,
  ): Promise<DebugProtocol.SetVariableResponse>;
  source(
    args: DebugProtocol.SourceArguments,
  ): Promise<DebugProtocol.SourceResponse>;
}

export interface IThread extends ITreeElement {
  /**
   * Process the thread belongs to
   */
  +process: IProcess;

  /**
   * Id of the thread generated by the debug adapter backend.
   */
  +threadId: number;

  /**
   * Name of the thread.
   */
  name: string;

  /**
   * Information about the current thread stop event. Null if thread is not stopped.
   */
  stoppedDetails: ?IRawStoppedDetails;

  /**
   * Information about the exception if an 'exception' stopped event raised and DA supports the 'exceptionInfo' request, otherwise null.
   */
  exceptionInfo(): Promise<?IExceptionInfo>;

  /**
   * Gets the top frame of the current call stack, or null if no frame is loaded.
   */
  getCallStackTopFrame(): ?IStackFrame;

  /**
   * Returns an observable that emits the full call stack for this thread if the
   * call stack is already fetched. If the call stack is not already fetched,
   * this routine fetches it asynchronously and returns an observable that
   * emits an Expect.Pending value followed by the call stack.
   */
  getFullCallStack(levels?: number): Observable<Expected<IStackFrame[]>>;

  /**
   * Returns the call stack for the current thread without attempting to
   * load it from the debug adapter.
   */
  getCachedCallStack(): IStackFrame[];

  /**
   * Invalidates the callstack cache.
   */
  clearCallStack(): void;

  /**
   * TODO: Ericblue this is here for the legacy call stack component
   * which is going away soon
   */
  refreshCallStack(levels: ?number): Promise<void>;

  /**
   * Returns true if the number of frames available > currentFrameCount.
   */
  additionalFramesAvailable(currentFrameCount: number): boolean;

  /**
   * Indicates whether this thread is stopped. The callstack for stopped
   * threads can be retrieved from the debug adapter.
   */
  stopped: boolean;

  next(): Promise<any>;
  stepIn(): Promise<any>;
  stepOut(): Promise<any>;
  stepBack(): Promise<any>;
  continue(): Promise<any>;
  pause(): Promise<any>;
  reverseContinue(): Promise<any>;
}

export interface IScope extends IExpressionContainer {
  +name: string;
  +expensive: boolean;
  +range: ?atom$Range;
}

export interface IProcess extends ITreeElement {
  +configuration: IProcessConfig;
  +session: ISession & ITreeElement;
  +sources: Map<string, ISource>;
  +debuggerMode: DebuggerModeType;
  exceptionBreakpoints: IExceptionBreakpoint[];
  getThread(threadId: number): ?IThread;
  getAllThreads(): IThread[];
  getSource(raw: ?DebugProtocol.Source): ISource;
  completions(
    frameId: number,
    text: string,
    position: atom$Point,
    overwriteBefore: number,
  ): Promise<Array<DebugProtocol.CompletionItem>>;
}

export interface IEnableable extends ITreeElement {
  enabled: boolean;
}

export interface IUIBreakpoint {
  +id: string;
  +uri: string;
  +line: number;
  +column: number;
  enabled: boolean;
  condition?: string;
  logMessage?: string;
}

export interface IExceptionBreakpoint extends IEnableable {
  +filter: string;
  +label: string;
}

export type IExceptionInfo = {
  id: ?string,
  description: ?string,
  breakMode: ?string,
  details: ?DebugProtocol.ExceptionDetails,
};

export interface IViewModel {
  /**
   * Returns the focused debug process or null if no process is stopped.
   */
  +focusedProcess: ?IProcess;

  /**
   * Returns the focused thread or null if no thread is stopped.
   */
  +focusedThread: ?IThread;

  /**
   * Returns the focused stack frame or null if there are no stack frames.
   */
  +focusedStackFrame: ?IStackFrame;

  setFocusedProcess(process: ?IProcess, explicit: boolean): void;
  setFocusedThread(thread: ?IThread, explicit: boolean): void;
  setFocusedStackFrame(stackFrame: ?IStackFrame, explicit: boolean): void;

  onDidChangeDebuggerFocus(
    callback: (data: {explicit: boolean}) => mixed,
  ): IDisposable;

  onDidChangeExpressionContext(
    callback: (data: {explicit: boolean}) => mixed,
  ): IDisposable;
}

export interface IModel extends ITreeElement {
  getProcesses(): IProcess[];
  getBreakpoints(): IBreakpoint[];
  getBreakpointAtLine(uri: string, line: number): ?IBreakpoint;
  getBreakpointById(id: string): ?IBreakpoint;

  areBreakpointsActivated(): boolean;
  getFunctionBreakpoints(): IFunctionBreakpoint[];
  getExceptionBreakpoints(): IExceptionBreakpoint[];
  getWatchExpressions(): IEvaluatableExpression[];

  onDidChangeBreakpoints(callback: () => mixed): IDisposable;
  onDidChangeCallStack(callback: () => mixed): IDisposable;
  onDidChangeWatchExpressions(
    callback: (expression: ?IExpression) => mixed,
  ): IDisposable;
  onDidChangeProcesses(callback: () => mixed): IDisposable;
}

/* Debugger mode */
export type DebuggerModeType =
  | 'starting'
  | 'running'
  | 'paused'
  | 'stopping'
  | 'stopped';

export interface IDebugService {
  +viewModel: IViewModel;

  /**
   * onDidChangeActiveThread callback is fired when the debugger service changes
   * which process and/or thread is active without explicit user intervention.
   * This can happen if a thread hits a breakpoint, throws an exception, etc.
   */
  onDidChangeActiveThread(callback: () => mixed): IDisposable;
  onDidChangeProcessMode(
    callback: (data: {process: IProcess, mode: DebuggerModeType}) => mixed,
  ): IDisposable;
  onDidStartDebugSession(
    callback: (config: IProcessConfig) => mixed,
  ): IDisposable;
  onDidCustomEvent(
    callback: (event: DebugProtocol.DebugEvent) => mixed,
  ): IDisposable;

  /**
   * Adds new breakpoints to the model. Notifies debug adapter of breakpoint changes.
   */
  addUIBreakpoints(uiBreakpoints: IUIBreakpoint[]): Promise<void>;

  /**
   * Updates breakpoints from the UI.
   */
  updateBreakpoints(uiBreakpoints: IUIBreakpoint[]): void;

  /**
   * Enables or disables all breakpoints. If breakpoint is passed only enables or disables the passed breakpoint.
   * Notifies debug adapter of breakpoint changes.
   */
  enableOrDisableBreakpoints(
    enable: boolean,
    breakpoint?: IEnableable,
  ): Promise<void>;

  toggleSourceBreakpoint(uri: string, line: number): Promise<void>;

  /**
   * Sets the global activated property for all breakpoints.
   * Notifies debug adapter of breakpoint changes.
   */
  setBreakpointsActivated(activated: boolean): Promise<void>;

  /**
   * Removes all breakpoints. If id is passed only removes the breakpoint associated with that id.
   * Notifies debug adapter of breakpoint changes.
   */
  removeBreakpoints(id?: string): Promise<void>;

  /**
   * Adds a new no name function breakpoint. The function breakpoint should be renamed once user enters the name.
   */
  addFunctionBreakpoint(): void;

  /**
   * Renames an already existing function breakpoint.
   * Notifies debug adapter of breakpoint changes.
   */
  renameFunctionBreakpoint(id: string, newFunctionName: string): Promise<void>;

  /**
   * Removes all function breakpoints. If id is passed only removes the function breakpoint with the passed id.
   * Notifies debug adapter of breakpoint changes.
   */
  removeFunctionBreakpoints(id?: string): Promise<void>;

  /**
   * Adds a new watch expression and evaluates it against the debug adapter.
   */
  addWatchExpression(name: string): void;

  /**
   * Creates an expression to be evaluated.
   */
  createExpression(rawExpression: string): IEvaluatableExpression;

  /**
   * Renames a watch expression and evaluates it against the debug adapter.
   */
  renameWatchExpression(id: string, newName: string): void;

  /**
   * Removes all watch expressions. If id is passed only removes the watch expression with the passed id.
   */
  removeWatchExpressions(id?: string): void;

  /**
   * Starts debugging. If the configOrName is not passed uses the selected configuration in the debug dropdown.
   * Also saves all files, manages if compounds are present in the configuration
   * and resolveds configurations via DebugConfigurationProviders.
   */
  startDebugging(config: IProcessConfig): Promise<void>;

  /**
   * Determines if the current focused process is restartable.
   */
  canRestartProcess(): boolean;

  /**
   * Restarts a process or creates a new one if there is no active session.
   */
  restartProcess(process: IProcess): Promise<any>;

  /**
   * Stops the process. If the process does not exist then stops all processes.
   */
  stopProcess(process: IProcess): Promise<void>;

  /**
   * Gets the current debug model.
   */
  getModel(): IModel;

  /**
   * Terminates the specified threads in the target.
   */
  terminateThreads(threadIds: Array<number>): Promise<void>;
}

export interface IStackFrame extends ITreeElement {
  thread: IThread;
  name: string;
  presentationHint: ?string;
  frameId: number;
  range: atom$Range;
  source: ISource;
  getScopes(forceRefresh: boolean): Promise<IScope[]>;
  getMostSpecificScopes(range: atom$Range): Promise<IScope[]>;
  restart(): Promise<void>;
  toString(): string;
  openInEditor(): Promise<?atom$TextEditor>;
}

export interface IBreakpoint extends IEnableable {
  +uri: string;
  +originalLine: number;
  +line: number;
  +column: number;
  +condition: ?string;
  +logMessage: ?string;
  +verified: boolean;
  +idFromAdapter: ?number;
  +adapterData?: any;
  // The following fields are used by the protocol but not by Nuclide.
  // endLine: ?number;
  // endColumn: ?number;
  // hitCondition: ?string;
  +hitCount: ?number;
}

export interface IFunctionBreakpoint extends IEnableable {
  name: string;
  verified: boolean;
  idFromAdapter: ?number;
  condition?: ?string;
  hitCondition?: ?string;
}

export type IRawStopppedUpdate = {
  sessionId: string,
  threadId: ?number,
  stoppedDetails: IRawStoppedDetails,
};

export type IRawThreadUpdate = {
  sessionId: string,
  thread: DebugProtocol.Thread,
};

export type IRawModelUpdate = IRawStopppedUpdate | IRawThreadUpdate;

export interface IRawStoppedDetails {
  reason?: string;
  preserveFocusHint?: boolean;
  description?: string;
  threadId?: number;
  text?: string;
  totalFrames?: number;
  allThreadsStopped?: boolean;
  framesErrorMessage?: string;
}

export type SerializedState = {
  sourceBreakpoints: ?Array<IBreakpoint>,
  functionBreakpoints: ?Array<IFunctionBreakpoint>,
  exceptionBreakpoints: ?Array<IExceptionBreakpoint>,
  watchExpressions: ?Array<string>,
  showDebugger: boolean,
  workspaceDocksVisibility: Array<boolean>,
};
