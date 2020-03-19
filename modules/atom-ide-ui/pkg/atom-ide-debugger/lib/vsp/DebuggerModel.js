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
The following debug model implementation was ported from VSCode's debugger implementation
in https://github.com/Microsoft/vscode/tree/master/src/vs/workbench/parts/debug

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

import type {
  IExpression,
  IExpressionContainer,
  IEvaluatableExpression,
  IStackFrame,
  IBreakpoint,
  IRawModelUpdate,
  IRawStopppedUpdate,
  IRawThreadUpdate,
  ISession,
  IThread,
  IModel,
  IScope,
  ISource,
  IProcess,
  IRawStoppedDetails,
  IEnableable,
  IUIBreakpoint,
  IExceptionInfo,
  IExceptionBreakpoint,
  IFunctionBreakpoint,
  ITreeElement,
  IVariable,
  SourcePresentationHint,
  DebuggerModeType,
} from '../types';
import type {IProcessConfig} from 'nuclide-debugger-common';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {getVSCodeDebuggerAdapterServiceByNuclideUri} from 'nuclide-debugger-common';
import * as DebugProtocol from 'vscode-debugprotocol';
import type {Expected} from 'nuclide-commons/expected';

import {Observable} from 'rxjs';
import uuid from 'uuid';
import nullthrows from 'nullthrows';
import invariant from 'assert';
import {Emitter, Range} from 'atom';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {track} from 'nuclide-commons/analytics';
import {
  AnalyticsEvents,
  UNKNOWN_SOURCE,
  DEBUG_SOURCES_URI,
  DebuggerMode,
} from '../constants';
import {openSourceLocation} from '../utils';
import {distinct} from 'nuclide-commons/collection';
import {Expect} from 'nuclide-commons/expected';

export class Source implements ISource {
  +uri: string;
  available: boolean;
  _raw: DebugProtocol.Source;

  constructor(raw: ?DebugProtocol.Source, sessionId: string) {
    if (raw == null) {
      this._raw = {name: UNKNOWN_SOURCE};
    } else {
      this._raw = raw;
    }
    if (this._raw.sourceReference != null && this._raw.sourceReference > 0) {
      const name =
        this._raw.name != null
          ? this._raw.name
          : this._raw.path != null
            ? nuclideUri.parsePath(this._raw.path).base
            : UNKNOWN_SOURCE;
      this.uri = `${DEBUG_SOURCES_URI}/${sessionId}/${
        this._raw.sourceReference
      }/${name}`;
    } else {
      this.uri = this._raw.path || '';
    }
    this.available = this.uri !== '';
  }

  get name(): ?string {
    return this._raw.name;
  }

  get origin(): ?string {
    return this._raw.origin;
  }

  get presentationHint(): ?SourcePresentationHint {
    return this._raw.presentationHint;
  }

  get raw(): DebugProtocol.Source {
    return {
      ...this._raw,
    };
  }

  get reference(): ?number {
    return this._raw.sourceReference;
  }

  get inMemory(): boolean {
    return this.uri.startsWith(DEBUG_SOURCES_URI);
  }

  openInEditor(): Promise<atom$TextEditor> {
    // eslint-disable-next-line nuclide-internal/atom-apis
    return atom.workspace.open(this.uri, {
      searchAllPanes: true,
      pending: true,
    });
  }
}

export class ExpressionContainer implements IExpressionContainer {
  static allValues: Map<string, string> = new Map();
  // Use chunks to support variable paging #9537
  static BASE_CHUNK_SIZE = 100;

  _value: string;
  _children: ?Promise<IVariable[]>;
  process: ?IProcess;
  _reference: number;
  _id: string;
  _namedVariables: number;
  _indexedVariables: number;
  _startOfVariables: number;

  constructor(
    process: ?IProcess,
    reference: number,
    id: string,
    namedVariables: ?number,
    indexedVariables: ?number,
    startOfVariables: ?number,
  ) {
    this.process = process;
    this._reference = reference;
    this._id = id;
    this._namedVariables = namedVariables || 0;
    this._indexedVariables = indexedVariables || 0;
    this._startOfVariables = startOfVariables || 0;
  }

  get reference(): number {
    return this._reference;
  }

  set reference(value: number) {
    this._reference = value;
    this._children = null;
  }

  get hasChildVariables(): boolean {
    return this._namedVariables + this._indexedVariables > 0;
  }

  getChildren(): Promise<IVariable[]> {
    if (this._children == null) {
      this._children = this._doGetChildren();
    }

    return this._children;
  }

  async _doGetChildren(): Promise<IVariable[]> {
    if (!this.hasChildren()) {
      return [];
    }

    if (!this.getChildrenInChunks) {
      const variables = await this._fetchVariables();
      return variables;
    }

    // Check if object has named variables, fetch them independent from indexed variables #9670
    let childrenArray: Array<IVariable> = [];
    if (Boolean(this._namedVariables)) {
      childrenArray = await this._fetchVariables(undefined, undefined, 'named');
    }

    // Use a dynamic chunk size based on the number of elements #9774
    let chunkSize = ExpressionContainer.BASE_CHUNK_SIZE;
    while (
      this._indexedVariables >
      chunkSize * ExpressionContainer.BASE_CHUNK_SIZE
    ) {
      chunkSize *= ExpressionContainer.BASE_CHUNK_SIZE;
    }

    if (this._indexedVariables > chunkSize) {
      // There are a lot of children, create fake intermediate values that represent chunks #9537
      const numberOfChunks = Math.ceil(this._indexedVariables / chunkSize);
      for (let i = 0; i < numberOfChunks; i++) {
        const start = this._startOfVariables + i * chunkSize;
        const count = Math.min(
          chunkSize,
          this._indexedVariables - i * chunkSize,
        );
        childrenArray.push(
          new Variable(
            this.process,
            this,
            this.reference,
            `[${start}..${start + count - 1}]`,
            '',
            '',
            null,
            count,
            {kind: 'virtual'},
            null,
            true,
            start,
          ),
        );
      }

      return childrenArray;
    }

    const variables = await this._fetchVariables(
      this._startOfVariables,
      this._indexedVariables,
      'indexed',
    );
    return childrenArray.concat(variables);
  }

  getId(): string {
    return this._id;
  }

  getValue(): string {
    return this._value;
  }

  hasChildren(): boolean {
    // only variables with reference > 0 have children.
    return this.reference > 0;
  }

  async _fetchVariables(
    start?: number,
    count?: number,
    filter?: 'indexed' | 'named',
  ): Promise<IVariable[]> {
    const process = this.process;
    invariant(process);
    try {
      const response: DebugProtocol.VariablesResponse = await process.session.variables(
        {
          variablesReference: this.reference,
          start,
          count,
          filter,
        },
      );
      const variables = distinct(
        response.body.variables.filter(v => v != null && v.name),
        v => v.name,
      );
      return variables.map(
        v =>
          new Variable(
            this.process,
            this,
            v.variablesReference,
            v.name,
            v.evaluateName,
            v.value,
            v.namedVariables,
            v.indexedVariables,
            v.presentationHint,
            v.type,
          ),
      );
    } catch (e) {
      return [
        new Variable(
          this.process,
          this,
          0,
          null,
          e.message,
          '',
          0,
          0,
          {kind: 'virtual'},
          null,
          false,
        ),
      ];
    }
  }

  // The adapter explicitly sents the children count of an expression only if there are lots of children which should be chunked.
  get getChildrenInChunks(): boolean {
    return Boolean(this._indexedVariables);
  }

  setValue(value: string) {
    this._value = value;
    ExpressionContainer.allValues.set(this.getId(), value);
  }

  toString(): string {
    return this._value;
  }
}

export class Expression extends ExpressionContainer
  implements IEvaluatableExpression {
  static DEFAULT_VALUE = 'not available';

  available: boolean;
  _type: ?string;
  name: string;

  constructor(name: string, id?: string = uuid.v4()) {
    super(null, 0, id);
    this.name = name;
    this.available = false;
    this._type = null;
    // name is not set if the expression is just being added
    // in that case do not set default value to prevent flashing #14499
    if (name) {
      this._value = Expression.DEFAULT_VALUE;
    }
  }

  get type(): ?string {
    return this._type;
  }

  async evaluate(
    process: ?IProcess,
    stackFrame: ?IStackFrame,
    context: string,
  ): Promise<void> {
    if (process == null || (stackFrame == null && context !== 'repl')) {
      this._value =
        context === 'repl'
          ? 'Please start a debug session to evaluate'
          : Expression.DEFAULT_VALUE;
      this.available = false;
      this.reference = 0;
      return;
    }

    this.process = process;
    try {
      const response: DebugProtocol.EvaluateResponse = await process.session.evaluate(
        {
          expression: this.name,
          frameId: stackFrame ? stackFrame.frameId : undefined,
          context,
        },
      );

      this.available = response != null && response.body != null;
      if (response && response.body) {
        this._value = response.body.result;
        this.reference = response.body.variablesReference || 0;
        this._namedVariables = response.body.namedVariables || 0;
        this._indexedVariables = response.body.indexedVariables || 0;
        this._type = response.body.type;
      }
    } catch (err) {
      this._value = err.message;
      this.available = false;
      this.reference = 0;
    }
  }

  toString(): string {
    return `${this.name}\n${this._value}`;
  }
}

export class Variable extends ExpressionContainer implements IVariable {
  parent: ExpressionContainer;
  name: string;
  evaluateName: ?string;
  presentationHint: ?DebugProtocol.VariablePresentationHint;
  _type: ?string;
  available: boolean;

  constructor(
    process: ?IProcess,
    parent: ExpressionContainer,
    reference: number,
    name: ?string,
    evaluateName: ?string,
    value: string,
    namedVariables: ?number,
    indexedVariables: ?number,
    presentationHint: ?DebugProtocol.VariablePresentationHint,
    type: ?string,
    available?: boolean = true,
    _startOfVariables: ?number,
  ) {
    super(
      process,
      reference,
      // flowlint-next-line sketchy-null-string:off
      `variable:${parent.getId()}:${name || 'no_name'}`,
      namedVariables,
      indexedVariables,
      _startOfVariables,
    );
    this.parent = parent;
    this.name = name == null ? 'no_name' : name;
    this.evaluateName = evaluateName;
    this.presentationHint = presentationHint;
    this._type = type;
    this.available = available;
    this._value = value;
  }

  get type(): ?string {
    return this._type;
  }

  get grammarName(): ?string {
    if (this.process == null) {
      return null;
    }
    return this.process.configuration.grammarName;
  }

  async setVariable(value: string): Promise<void> {
    const process = nullthrows(this.process);
    track(AnalyticsEvents.DEBUGGER_EDIT_VARIABLE, {
      language: process.configuration.adapterType,
    });
    const response = await process.session.setVariable({
      name: nullthrows(this.name),
      value,
      variablesReference: this.parent.reference,
    });
    if (response && response.body) {
      this._value = response.body.value;
      this._type = response.body.type == null ? this._type : response.body.type;
      this.reference = response.body.variablesReference || 0;
      this._namedVariables = response.body.namedVariables || 0;
      this._indexedVariables = response.body.indexedVariables || 0;
    }
  }

  canSetVariable(): boolean {
    const proc = this.process;
    if (proc == null) {
      return false;
    }

    const supportsSetVariable = Boolean(
      proc.session.capabilities.supportsSetVariable,
    );

    // We can't set variables if the target is read only.
    // We also require a variables reference for the parent for the protocol,
    // and currently only set on leaves (variables with no children) because
    // this layer doesn't know how to parse initializer expressions for setting
    // the value of complex objects or arrays.
    // TODO: It'd be nice to be able to set array identities here like: a = {1, 2, 3}.
    const isReadOnlyTarget = Boolean(proc.configuration.isReadOnly);
    const hasValidParentReference =
      this.parent.reference != null &&
      !Number.isNaN(this.parent.reference) &&
      this.parent.reference >= 0;
    return (
      !isReadOnlyTarget &&
      supportsSetVariable &&
      hasValidParentReference &&
      !this.hasChildren()
    );
  }

  toString(): string {
    return `${this.name}: ${this._value}`;
  }
}

export class Scope extends ExpressionContainer implements IScope {
  +name: string;
  +expensive: boolean;
  +range: ?atom$Range;

  constructor(
    stackFrame: IStackFrame,
    index: number,
    name: string,
    reference: number,
    expensive: boolean,
    namedVariables: ?number,
    indexedVariables: ?number,
    range: ?atom$Range,
  ) {
    super(
      stackFrame.thread.process,
      reference,
      `scope:${stackFrame.getId()}:${name}:${index}`,
      namedVariables,
      indexedVariables,
    );
    this.name = name;
    this.expensive = expensive;
    this.range = range;
  }
}

export class StackFrame implements IStackFrame {
  scopes: ?Promise<Scope[]>;
  thread: IThread;
  frameId: number;
  source: ISource;
  name: string;
  presentationHint: ?string;
  range: atom$Range;
  index: number;

  constructor(
    thread: IThread,
    frameId: number,
    source: ISource,
    name: string,
    presentationHint: ?string,
    range: atom$Range,
    index: number,
  ) {
    this.thread = thread;
    this.frameId = frameId;
    this.source = source;
    this.name = name;
    this.presentationHint = presentationHint;
    this.range = range;
    this.index = index;
    this.scopes = null;
  }

  getId(): string {
    return `stackframe:${this.thread.getId()}:${this.frameId}:${this.index}`;
  }

  async getScopes(forceRefresh: boolean): Promise<IScope[]> {
    if (this.scopes == null || forceRefresh) {
      this.scopes = this._getScopesImpl();
    }
    return (this.scopes: any);
  }

  async _getScopesImpl(): Promise<Scope[]> {
    try {
      const {
        body: {scopes},
      } = await this.thread.process.session.scopes({
        frameId: this.frameId,
      });
      return scopes.map(
        (rs, index) =>
          new Scope(
            this,
            index,
            rs.name,
            rs.variablesReference,
            rs.expensive,
            rs.namedVariables,
            rs.indexedVariables,
            rs.line != null
              ? new Range(
                  [rs.line - 1, (rs.column != null ? rs.column : 1) - 1],
                  [
                    (rs.endLine != null ? rs.endLine : rs.line) - 1,
                    (rs.endColumn != null ? rs.endColumn : 1) - 1,
                  ],
                )
              : null,
          ),
      );
    } catch (err) {
      return [];
    }
  }

  async getMostSpecificScopes(range: atom$Range): Promise<IScope[]> {
    const scopes: Array<IScope> = (await this.getScopes(false)).filter(
      s => !s.expensive,
    );
    const haveRangeInfo = scopes.some(s => s.range != null);
    if (!haveRangeInfo) {
      return scopes;
    }

    const scopesContainingRange = scopes
      .filter(scope => scope.range != null && scope.range.containsRange(range))
      .sort((first, second) => {
        const firstRange = nullthrows(first.range);
        const secondRange = nullthrows(second.range);
        // prettier-ignore
        return (firstRange.end.row - firstRange.start.row) -
          (secondRange.end.row - secondRange.end.row);
      });
    return scopesContainingRange.length ? scopesContainingRange : scopes;
  }

  async restart(): Promise<void> {
    await this.thread.process.session.restartFrame(
      {frameId: this.frameId},
      this.thread.threadId,
    );
  }

  toString(): string {
    return `${this.name} (${
      this.source.inMemory ? nullthrows(this.source.name) : this.source.uri
    }:${this.range.start.row})`;
  }

  async openInEditor(): Promise<?atom$TextEditor> {
    const rawPath = this.source.raw.path;
    const localRawPath = nuclideUri.getPath(rawPath || '');
    if (
      rawPath != null &&
      localRawPath !== '' &&
      (await getVSCodeDebuggerAdapterServiceByNuclideUri(rawPath).exists(
        localRawPath,
      ))
    ) {
      return openSourceLocation(rawPath, this.range.start.row);
    }
    if (this.source.available) {
      return openSourceLocation(this.source.uri, this.range.start.row);
    }
    return null;
  }
}

type CallStack = {|
  valid: boolean,
  callFrames: IStackFrame[],
|};

export class Thread implements IThread {
  _callStack: CallStack;
  _refreshInProgress: boolean;
  stoppedDetails: ?IRawStoppedDetails;
  stopped: boolean;
  +process: IProcess;
  +threadId: number;
  name: string;

  constructor(process: IProcess, name: string, threadId: number) {
    this.process = process;
    this.name = name;
    this.threadId = threadId;
    this.stoppedDetails = null;
    this._callStack = this._getEmptyCallstackState();
    this.stopped = false;
    this._refreshInProgress = false;
  }

  _getEmptyCallstackState(): CallStack {
    return {
      valid: false,
      callFrames: [],
    };
  }

  _isCallstackLoaded(): boolean {
    return this._callStack.valid;
  }

  _isCallstackFullyLoaded(): boolean {
    return (
      this._isCallstackLoaded() &&
      this.stoppedDetails != null &&
      this.stoppedDetails.totalFrames != null &&
      !Number.isNaN(this.stoppedDetails.totalFrames) &&
      this.stoppedDetails.totalFrames >= 0 &&
      this._callStack.callFrames.length >= this.stoppedDetails.totalFrames
    );
  }

  getId(): string {
    return `thread:${this.process.getId()}:${this.threadId}`;
  }

  additionalFramesAvailable(currentFrameCount: number): boolean {
    if (this._callStack.callFrames.length > currentFrameCount) {
      return true;
    }
    const supportsDelayLoading =
      nullthrows(this.process).session.capabilities
        .supportsDelayedStackTraceLoading === true;
    if (
      supportsDelayLoading &&
      this.stoppedDetails != null &&
      this.stoppedDetails.totalFrames != null &&
      this.stoppedDetails.totalFrames > currentFrameCount
    ) {
      return true;
    }

    return false;
  }

  clearCallStack(): void {
    this._callStack = this._getEmptyCallstackState();
  }

  getCallStackTopFrame(): ?IStackFrame {
    return this._isCallstackLoaded() ? this._callStack.callFrames[0] : null;
  }

  getFullCallStack(levels?: number): Observable<Expected<IStackFrame[]>> {
    if (
      this._refreshInProgress ||
      this._isCallstackFullyLoaded() ||
      (levels != null &&
        this._isCallstackLoaded() &&
        this._callStack.callFrames.length >= levels)
    ) {
      // We have a sufficent call stack already loaded, just return it.
      return Observable.of(Expect.value(this._callStack.callFrames));
    }

    // Return a pending value and kick off the fetch. When the fetch
    // is done, emit the new call frames.
    return Observable.concat(
      Observable.of(Expect.pending()),
      Observable.fromPromise(this.refreshCallStack(levels)).switchMap(() =>
        Observable.of(Expect.value(this._callStack.callFrames)),
      ),
    );
  }

  getCachedCallStack(): IStackFrame[] {
    return this._callStack.callFrames;
  }

  /**
   * Queries the debug adapter for the callstack and returns a promise
   * which completes once the call stack has been retrieved.
   * If the thread is not stopped, it returns a promise to an empty array.
   *
   * If specified, levels indicates the maximum depth of call frames to fetch.
   */
  async refreshCallStack(levels: ?number): Promise<void> {
    if (!this.stopped) {
      return;
    }

    const supportsDelayLoading =
      nullthrows(this.process).session.capabilities
        .supportsDelayedStackTraceLoading === true;

    this._refreshInProgress = true;
    try {
      if (supportsDelayLoading) {
        const start = this._callStack.callFrames.length;
        const callStack = await this._getCallStackImpl(start, levels);
        if (start < this._callStack.callFrames.length) {
          // Set the stack frames for exact position we requested.
          // To make sure no concurrent requests create duplicate stack frames #30660
          this._callStack.callFrames.splice(
            start,
            this._callStack.callFrames.length - start,
          );
        }
        this._callStack.callFrames = this._callStack.callFrames.concat(
          callStack || [],
        );
      } else {
        // Must load the entire call stack, the debugger backend doesn't support
        // delayed call stack loading.
        this._callStack.callFrames =
          (await this._getCallStackImpl(0, null)) || [];
      }

      this._callStack.valid = true;
    } finally {
      this._refreshInProgress = false;
    }
  }

  async _getCallStackImpl(
    startFrame: number,
    levels: ?number,
  ): Promise<IStackFrame[]> {
    try {
      const stackTraceArgs: DebugProtocol.StackTraceArguments = {
        threadId: this.threadId,
        startFrame,
      };

      // Only include levels if specified and supported. If levels is omitted,
      // the debug adapter is to return all stack frames, per the protocol.
      if (levels != null) {
        stackTraceArgs.levels = levels;
      }

      const response: DebugProtocol.StackTraceResponse = await this.process.session.stackTrace(
        stackTraceArgs,
      );
      if (response == null || response.body == null) {
        return [];
      }
      if (this.stoppedDetails != null) {
        this.stoppedDetails.totalFrames = response.body.totalFrames;
      }

      return response.body.stackFrames.map((rsf, index) => {
        const source = this.process.getSource(rsf.source);

        return new StackFrame(
          this,
          rsf.id,
          source,
          rsf.name,
          rsf.presentationHint,
          // The UI is 0-based while VSP is 1-based.
          new Range(
            [rsf.line - 1, (rsf.column || 1) - 1],
            [
              (rsf.endLine != null ? rsf.endLine : rsf.line) - 1,
              (rsf.endColumn != null ? rsf.endColumn : 1) - 1,
            ],
          ),
          startFrame + index,
        );
      });
    } catch (err) {
      if (this.stoppedDetails != null) {
        this.stoppedDetails.framesErrorMessage = err.message;
      }

      return [];
    }
  }

  /**
   * Returns exception info promise if the exception was thrown, otherwise null
   */
  async exceptionInfo(): Promise<?IExceptionInfo> {
    const session = this.process.session;
    if (
      this.stoppedDetails == null ||
      this.stoppedDetails.reason !== 'exception'
    ) {
      return null;
    }
    const stoppedDetails = this.stoppedDetails;
    if (!session.capabilities.supportsExceptionInfoRequest) {
      return {
        id: null,
        details: null,
        description: stoppedDetails.description,
        breakMode: null,
      };
    }

    const exception: DebugProtocol.ExceptionInfoResponse = await session.exceptionInfo(
      {threadId: this.threadId},
    );
    if (exception == null) {
      return null;
    }

    return {
      id: exception.body.exceptionId,
      description: exception.body.description,
      breakMode: exception.body.breakMode,
      details: exception.body.details,
    };
  }

  async next(): Promise<void> {
    track(AnalyticsEvents.DEBUGGER_STEP_OVER);
    await this.process.session.next({threadId: this.threadId});
  }

  async stepIn(): Promise<void> {
    track(AnalyticsEvents.DEBUGGER_STEP_INTO);
    await this.process.session.stepIn({threadId: this.threadId});
  }

  async stepOut(): Promise<void> {
    track(AnalyticsEvents.DEBUGGER_STEP_OUT);
    await this.process.session.stepOut({threadId: this.threadId});
  }

  async stepBack(): Promise<void> {
    track(AnalyticsEvents.DEBUGGER_STEP_BACK);
    await this.process.session.stepBack({threadId: this.threadId});
  }

  async continue(): Promise<void> {
    track(AnalyticsEvents.DEBUGGER_STEP_CONTINUE);
    await this.process.session.continue({threadId: this.threadId});
  }

  async pause(): Promise<void> {
    track(AnalyticsEvents.DEBUGGER_STEP_PAUSE);
    await this.process.session.pause({threadId: this.threadId});
  }

  async reverseContinue(): Promise<void> {
    await this.process.session.reverseContinue({threadId: this.threadId});
  }
}

export class Process implements IProcess {
  _sources: Map<string, ISource>;
  _threads: Map<number, Thread>;
  _session: ISession & ITreeElement;
  _configuration: IProcessConfig;
  _pendingStart: boolean;
  _pendingStop: boolean;
  breakpoints: Breakpoint[];
  exceptionBreakpoints: IExceptionBreakpoint[];

  constructor(configuration: IProcessConfig, session: ISession & ITreeElement) {
    this._configuration = configuration;
    this._session = session;
    this._threads = new Map();
    this._sources = new Map();
    this._pendingStart = true;
    this._pendingStop = false;
    this.breakpoints = [];
    this.exceptionBreakpoints = [];
  }

  get sources(): Map<string, ISource> {
    return this._sources;
  }

  get session(): ISession & ITreeElement {
    return this._session;
  }

  get configuration(): IProcessConfig {
    return this._configuration;
  }

  get debuggerMode(): DebuggerModeType {
    if (this._pendingStart) {
      return DebuggerMode.STARTING;
    }

    if (this._pendingStop) {
      return DebuggerMode.STOPPING;
    }

    if (this.getAllThreads().some(t => t.stopped)) {
      // TOOD: Currently our UX controls support resume and async-break
      // on a per-process basis only. This needs to be modified here if
      // we add support for freezing and resuming individual threads.
      return DebuggerMode.PAUSED;
    }

    return DebuggerMode.RUNNING;
  }

  clearProcessStartingFlag(): void {
    this._pendingStart = false;
  }

  setStopPending(): void {
    this._pendingStop = true;
  }

  getSource(raw: ?DebugProtocol.Source): ISource {
    let source = new Source(raw, this.getId());
    if (this._sources.has(source.uri)) {
      source = nullthrows(this._sources.get(source.uri));
    } else {
      this._sources.set(source.uri, source);
    }

    return source;
  }

  getThread(threadId: number): ?Thread {
    return this._threads.get(threadId);
  }

  getAllThreads(): IThread[] {
    return Array.from(this._threads.values());
  }

  getId(): string {
    return this._session.getId();
  }

  rawStoppedUpdate(data: IRawStopppedUpdate): void {
    const {threadId, stoppedDetails} = data;

    this.clearProcessStartingFlag();

    if (threadId != null && !this._threads.has(threadId)) {
      // We're being asked to update a thread we haven't seen yet, so
      // create it
      const thread = new Thread(this, `Thread ${threadId}`, threadId);
      this._threads.set(threadId, thread);
    }

    // Set the availability of the threads' callstacks depending on
    // whether the thread is stopped or not
    if (stoppedDetails.allThreadsStopped) {
      this._threads.forEach(thread => {
        thread.stoppedDetails =
          thread.threadId === threadId ? stoppedDetails : thread.stoppedDetails;
        thread.stopped = true;
        thread.clearCallStack();
      });
    } else if (threadId != null) {
      // One thread is stopped, only update that thread.
      const thread = nullthrows(this._threads.get(threadId));
      thread.stoppedDetails = stoppedDetails;
      thread.clearCallStack();
      thread.stopped = true;
    }
  }

  rawThreadUpdate(data: IRawThreadUpdate): void {
    const {thread} = data;

    this.clearProcessStartingFlag();

    if (!this._threads.has(thread.id)) {
      // A new thread came in, initialize it.
      this._threads.set(thread.id, new Thread(this, thread.name, thread.id));
    } else if (thread.name) {
      // Just the thread name got updated #18244
      nullthrows(this._threads.get(thread.id)).name = thread.name;
    }
  }

  clearThreads(removeThreads: boolean, reference?: number): void {
    if (reference != null) {
      if (this._threads.has(reference)) {
        const thread = nullthrows(this._threads.get(reference));
        thread.clearCallStack();
        thread.stoppedDetails = null;
        thread.stopped = false;

        if (removeThreads) {
          this._threads.delete(reference);
        }
      }
    } else {
      this._threads.forEach(thread => {
        thread.clearCallStack();
        thread.stoppedDetails = null;
        thread.stopped = false;
      });

      if (removeThreads) {
        this._threads.clear();
        ExpressionContainer.allValues.clear();
      }
    }
  }

  async completions(
    frameId: number,
    text: string,
    position: atom$Point,
    overwriteBefore: number,
  ): Promise<Array<DebugProtocol.CompletionItem>> {
    if (!this._session.capabilities.supportsCompletionsRequest) {
      return [];
    }
    try {
      const response = await this._session.completions({
        frameId,
        text,
        column: position.column,
        line: position.row,
      });
      if (response && response.body && response.body.targets) {
        return response.body.targets;
      } else {
        return [];
      }
    } catch (error) {
      return [];
    }
  }
}

export class Breakpoint implements IBreakpoint {
  verified: boolean;
  idFromAdapter: ?number;
  uiBreakpointId: string;
  uri: string;
  line: number;
  originalLine: number;
  column: number;
  enabled: boolean;
  condition: ?string;
  logMessage: ?string;
  adapterData: any;
  hitCount: ?number;

  constructor(
    uiBreakpointId: string,
    uri: string,
    line: number,
    column: number,
    enabled: boolean,
    condition: ?string,
    logMessage: ?string,
    adapterData?: any,
  ) {
    this.uri = uri;
    this.line = line;
    this.originalLine = line;
    this.column = column;
    this.enabled = enabled;
    this.condition = condition;
    this.adapterData = adapterData;
    this.verified = false;
    this.uiBreakpointId = uiBreakpointId;
    this.hitCount = null;

    if (condition != null && condition.trim() !== '') {
      this.condition = condition;
    } else {
      this.condition = null;
    }
    if (logMessage != null && logMessage.trim() !== '') {
      this.logMessage = logMessage;
    } else {
      this.logMessage = null;
    }
  }

  getId(): string {
    return this.uiBreakpointId;
  }
}

export class FunctionBreakpoint implements IFunctionBreakpoint {
  id: string;
  verified: boolean;
  idFromAdapter: ?number;
  name: string;
  enabled: boolean;
  hitCondition: ?string;
  condition: ?string;

  constructor(name: string, enabled: boolean, hitCondition: ?string) {
    this.name = name;
    this.enabled = enabled;
    this.hitCondition = hitCondition;
    this.condition = null;
    this.verified = false;
    this.idFromAdapter = null;
    this.id = uuid.v4();
  }

  getId(): string {
    return this.id;
  }
}

export class ExceptionBreakpoint implements IExceptionBreakpoint {
  _id: string;
  +filter: string;
  +label: string;
  enabled: boolean;

  constructor(filter: string, label: string, enabled: ?boolean) {
    this.filter = filter;
    this.label = label;
    this.enabled = enabled == null ? false : enabled;
    this._id = uuid.v4();
  }

  getId(): string {
    return this._id;
  }
}

const BREAKPOINTS_CHANGED = 'BREAKPOINTS_CHANGED';
const WATCH_EXPRESSIONS_CHANGED = 'WATCH_EXPRESSIONS_CHANGED';

const CALLSTACK_CHANGED = 'CALLSTACK_CHANGED';
const PROCESSES_CHANGED = 'PROCESSES_CHANGED';

type getFocusedProcessCallback = () => ?IProcess;

type SyncOptions = {
  fireEvent: boolean,
};

export class Model implements IModel {
  _processes: Process[];
  _uiBreakpoints: IUIBreakpoint[];
  _breakpointsActivated: boolean;
  _functionBreakpoints: FunctionBreakpoint[];
  _watchExpressions: Expression[];
  _disposables: UniversalDisposable;
  _emitter: Emitter;
  _getFocusedProcess: getFocusedProcessCallback;

  // Exception breakpoint filters are different for each debugger back-end, so they
  // are process-specific. However, when we're not debugging, ideally we'd want to still
  // show filters so that a user can set break on exception before starting debugging, to
  // enable breaking on early exceptions as the target starts. For this reason, we cache
  // whatever options the most recently focused process offered, and offer those.
  _mostRecentExceptionBreakpoints: IExceptionBreakpoint[];

  constructor(
    uiBreakpoints: IUIBreakpoint[],
    breakpointsActivated: boolean,
    functionBreakpoints: FunctionBreakpoint[],
    exceptionBreakpoints: ExceptionBreakpoint[],
    watchExpressions: Expression[],
    getFocusedProcess: getFocusedProcessCallback,
  ) {
    this._processes = [];
    this._uiBreakpoints = uiBreakpoints;
    this._breakpointsActivated = breakpointsActivated;
    this._functionBreakpoints = functionBreakpoints;
    this._mostRecentExceptionBreakpoints = ((exceptionBreakpoints: any): IExceptionBreakpoint[]);
    this._watchExpressions = watchExpressions;
    this._getFocusedProcess = getFocusedProcess;
    this._emitter = new Emitter();
    this._disposables = new UniversalDisposable(this._emitter);
  }

  getId(): string {
    return 'root';
  }

  getProcesses(): IProcess[] {
    return (this._processes: any);
  }

  addProcess(
    configuration: IProcessConfig,
    session: ISession & ITreeElement,
  ): Process {
    const process = new Process(configuration, session);

    // Add breakpoints to process.
    const processBreakpoints = process.breakpoints;
    for (const uiBp of this._uiBreakpoints) {
      processBreakpoints.push(
        new Breakpoint(
          uiBp.id,
          uiBp.uri,
          uiBp.line,
          uiBp.column,
          uiBp.enabled,
          uiBp.condition,
          uiBp.logMessage,
        ),
      );
    }

    this._processes.push(process);
    this._emitter.emit(PROCESSES_CHANGED);
    return process;
  }

  removeProcess(id: string): Array<Process> {
    const removedProcesses = [];
    this._processes = this._processes.filter(p => {
      if (p.getId() === id) {
        removedProcesses.push(p);
        return false;
      } else {
        return true;
      }
    });
    this._emitter.emit(PROCESSES_CHANGED);

    if (removedProcesses.length > 0) {
      this._mostRecentExceptionBreakpoints =
        removedProcesses[0].exceptionBreakpoints;
    }
    return removedProcesses;
  }

  onDidChangeBreakpoints(callback: () => mixed): IDisposable {
    return this._emitter.on(BREAKPOINTS_CHANGED, callback);
  }

  // TODO: Scope this so that only the tree nodes for the process that
  // had a call stack change need to re-render
  onDidChangeCallStack(callback: () => mixed): IDisposable {
    return this._emitter.on(CALLSTACK_CHANGED, callback);
  }

  onDidChangeProcesses(callback: () => mixed): IDisposable {
    return this._emitter.on(PROCESSES_CHANGED, callback);
  }

  onDidChangeWatchExpressions(
    callback: (expression: ?IExpression) => mixed,
  ): IDisposable {
    return this._emitter.on(WATCH_EXPRESSIONS_CHANGED, callback);
  }

  rawUpdate(data: IRawModelUpdate): void {
    const process = this._processes
      .filter(p => p.getId() === data.sessionId)
      .pop();
    if (process == null) {
      return;
    }
    if (data.stoppedDetails != null) {
      process.rawStoppedUpdate((data: any));
    } else {
      process.rawThreadUpdate((data: any));
    }

    this._emitter.emit(CALLSTACK_CHANGED);
  }

  clearThreads(id: string, removeThreads: boolean, reference?: number): void {
    const process = this._processes.filter(p => p.getId() === id).pop();

    if (process != null) {
      process.clearThreads(removeThreads, reference);
      this._emitter.emit(CALLSTACK_CHANGED);
    }
  }

  async refreshCallStack(
    threadI: IThread,
    fetchAllFrames: boolean,
  ): Promise<void> {
    const thread: Thread = (threadI: any);

    // If the debugger supports delayed stack trace loading, load only
    // the first call stack frame, which is needed to display in the threads
    // view. We will lazily load the remaining frames only for threads that
    // are visible in the UI, allowing us to skip loading frames we don't
    // need right now.
    const framesToLoad =
      nullthrows(thread.process).session.capabilities
        .supportsDelayedStackTraceLoading && !fetchAllFrames
        ? 1
        : null;

    thread.clearCallStack();
    await thread.refreshCallStack(framesToLoad);
    this._emitter.emit(CALLSTACK_CHANGED);
  }

  getUIBreakpoints(): IUIBreakpoint[] {
    return this._uiBreakpoints;
  }

  getBreakpoints(): IBreakpoint[] {
    // If we're currently debugging, return the breakpoints as the current
    // debug adapter sees them.
    const focusedProcess = this._getFocusedProcess();
    if (focusedProcess != null) {
      const currentProcess = this._processes.find(
        p => p.getId() === focusedProcess.getId(),
      );
      if (currentProcess != null) {
        return (currentProcess.breakpoints: any);
      }
    }

    // Otherwise, return the UI breakpoints. Since there is no debug process,
    // the breakpoints have their original line location and no notion of
    // verified vs not.
    return this._uiBreakpoints.map(uiBp => {
      const bp = new Breakpoint(
        uiBp.id,
        uiBp.uri,
        uiBp.line,
        uiBp.column,
        uiBp.enabled,
        uiBp.condition,
        uiBp.logMessage,
      );
      bp.verified = true;
      return bp;
    });
  }

  getBreakpointAtLine(uri: string, line: number): ?IBreakpoint {
    let breakpoint = this.getBreakpoints().find(
      bp => bp.uri === uri && bp.line === line,
    );
    if (breakpoint == null) {
      breakpoint = this.getBreakpoints().find(
        bp => bp.uri === uri && bp.originalLine === line,
      );
    }
    return breakpoint;
  }

  getBreakpointById(id: string): ?IBreakpoint {
    return this.getBreakpoints().find(bp => bp.getId() === id);
  }

  getFunctionBreakpoints(): IFunctionBreakpoint[] {
    return (this._functionBreakpoints: any);
  }

  getExceptionBreakpoints(): IExceptionBreakpoint[] {
    const focusedProcess = this._getFocusedProcess();
    if (focusedProcess != null) {
      return (focusedProcess.exceptionBreakpoints: any);
    }
    return (this._mostRecentExceptionBreakpoints: any);
  }

  setExceptionBreakpoints(
    process: IProcess,
    data: DebugProtocol.ExceptionBreakpointsFilter[],
  ): void {
    process.exceptionBreakpoints = data.map(d => {
      const ebp = process.exceptionBreakpoints
        .filter(bp => bp.filter === d.filter)
        .pop();
      return new ExceptionBreakpoint(
        d.filter,
        d.label,
        ebp ? ebp.enabled : d.default,
      );
    });
    this._emitter.emit(BREAKPOINTS_CHANGED);
  }

  areBreakpointsActivated(): boolean {
    return this._breakpointsActivated;
  }

  setBreakpointsActivated(activated: boolean): void {
    this._breakpointsActivated = activated;
    this._emitter.emit(BREAKPOINTS_CHANGED);
  }

  addUIBreakpoints(
    uiBreakpoints: IUIBreakpoint[],
    fireEvent?: boolean = true,
  ): void {
    this._uiBreakpoints = this._uiBreakpoints.concat(uiBreakpoints);
    this._breakpointsActivated = true;
    this._sortSyncAndDeDup({fireEvent});
  }

  removeBreakpoints(toRemove: IBreakpoint[]): void {
    this._uiBreakpoints = this._uiBreakpoints.filter(
      bp => !toRemove.some(r => r.getId() === bp.id),
    );

    this._sortSyncAndDeDup();
  }

  updateBreakpoints(newBps: IUIBreakpoint[]): void {
    this._uiBreakpoints = this._uiBreakpoints
      .filter(bp => !newBps.some(n => n.id === bp.id))
      .concat(newBps);

    this._sortSyncAndDeDup();
  }

  // This is called when a breakpoint is updated by the debug adapter.
  // It affects only breakpoints for a particular session.
  updateProcessBreakpoints(
    process: IProcess,
    data: {
      [id: string]: DebugProtocol.Breakpoint,
    },
  ): void {
    const proc = this._processes.find(p => p.getId() === process.getId());
    if (proc == null) {
      return;
    }

    const breakpoints = proc.breakpoints;
    breakpoints.forEach(bp => {
      const bpData = data[bp.getId()];
      if (bpData != null) {
        // The breakpoint's calibrated location can be different from its
        // initial location. Since we don't display ranges in the UX, a bp
        // has only one line location. We prefer the endLine if the bp instruction
        // matches a range of lines. Otherwise fall back to the (start) line.
        bp.line =
          bpData.endLine != null
            ? bpData.endLine
            : bpData.line != null
              ? bpData.line
              : bp.line;
        bp.column = bpData.column != null ? bpData.column : bp.column;
        bp.verified = bpData.verified != null ? bpData.verified : bp.verified;
        bp.idFromAdapter = bpData.id;
        bp.adapterData = bpData.source
          ? bpData.source.adapterData
          : bp.adapterData;
        bp.hitCount = bpData.nuclide_hitCount;
      }
    });
    this._sortSyncAndDeDup();
  }

  _sortSyncAndDeDup(options?: SyncOptions): void {
    const comparer = (first, second) => {
      if (first.uri !== second.uri) {
        return first.uri.localeCompare(second.uri);
      }
      if (first.line === second.line) {
        return first.column - second.column;
      }

      return first.line - second.line;
    };

    this._uiBreakpoints = distinct(
      this._uiBreakpoints.sort(comparer),
      bp => `${bp.uri}:${bp.line}:${bp.column}`,
    );

    // Sync with all active processes.
    const bpIds = new Set();
    for (const bp of this._uiBreakpoints) {
      bpIds.add(bp.id);
    }

    for (const process of this._processes) {
      // Remove any breakpoints from the process that no longer exist in the UI.
      process.breakpoints = process.breakpoints.filter(bp =>
        bpIds.has(bp.getId()),
      );

      // Sync any to the process that are missing.
      const processBps = new Map();
      for (const processBreakpoint of process.breakpoints) {
        processBps.set(processBreakpoint.getId(), processBreakpoint);
      }

      for (const uiBp of this._uiBreakpoints) {
        const processBp = processBps.get(uiBp.id);
        if (processBp == null) {
          process.breakpoints.push(
            new Breakpoint(
              uiBp.id,
              uiBp.uri,
              uiBp.line,
              uiBp.column,
              uiBp.enabled,
              uiBp.condition,
              uiBp.logMessage,
            ),
          );
        } else {
          processBp.enabled = uiBp.enabled;
          processBp.condition = uiBp.condition;
        }
      }

      // Sort.
      process.breakpoints = process.breakpoints.sort(comparer);
    }

    if (options == null || options.fireEvent) {
      this._emitter.emit(BREAKPOINTS_CHANGED);
    }
  }

  setEnablement(element: IEnableable, enable: boolean): void {
    element.enabled = enable;
    const uiBp = this._uiBreakpoints.find(bp => bp.id === element.getId());
    if (uiBp != null) {
      uiBp.enabled = enable;
    }
    this._sortSyncAndDeDup();
  }

  enableOrDisableAllBreakpoints(enable: boolean): void {
    this._uiBreakpoints.forEach(bp => {
      bp.enabled = enable;
    });
    this._functionBreakpoints.forEach(fbp => {
      fbp.enabled = enable;
    });

    this._sortSyncAndDeDup();
  }

  addFunctionBreakpoint(functionName: string): FunctionBreakpoint {
    const newFunctionBreakpoint = new FunctionBreakpoint(
      functionName,
      true,
      null,
    );
    this._functionBreakpoints.push(newFunctionBreakpoint);
    this._emitter.emit(BREAKPOINTS_CHANGED);
    return newFunctionBreakpoint;
  }

  updateFunctionBreakpoints(data: {
    [id: string]: {
      name?: string,
      verified?: boolean,
      id?: number,
      hitCondition?: string,
    },
  }): void {
    this._functionBreakpoints.forEach(fbp => {
      const fbpData = data[fbp.getId()];
      if (fbpData != null) {
        fbp.name = fbpData.name != null ? fbpData.name : fbp.name;
        fbp.verified = fbpData.verified || fbp.verified;
        fbp.idFromAdapter = fbpData.id;
        fbp.hitCondition = fbpData.hitCondition;
      }
    });

    this._emitter.emit(BREAKPOINTS_CHANGED);
  }

  removeFunctionBreakpoints(id?: string): void {
    let removed: FunctionBreakpoint[];
    if (id != null) {
      removed = this._functionBreakpoints.filter(fbp => fbp.getId() === id);
      this._functionBreakpoints = this._functionBreakpoints.filter(
        fbp => fbp.getId() !== id,
      );
    } else {
      removed = this._functionBreakpoints;
      this._functionBreakpoints = [];
    }
    this._emitter.emit(BREAKPOINTS_CHANGED, {removed});
  }

  getWatchExpressions(): IEvaluatableExpression[] {
    return (this._watchExpressions: any);
  }

  addWatchExpression(name: string): void {
    const we = new Expression(name);
    this._watchExpressions.push(we);
    this._emitter.emit(WATCH_EXPRESSIONS_CHANGED, we);
  }

  renameWatchExpression(id: string, newName: string): void {
    const filtered = this._watchExpressions.filter(we => we.getId() === id);
    if (filtered.length === 1) {
      filtered[0].name = newName;
      this._emitter.emit(WATCH_EXPRESSIONS_CHANGED, filtered[0]);
    }
  }

  removeWatchExpressions(id: ?string): void {
    this._watchExpressions =
      id != null ? this._watchExpressions.filter(we => we.getId() !== id) : [];
    this._emitter.emit(WATCH_EXPRESSIONS_CHANGED);
  }

  sourceIsNotAvailable(uri: string): void {
    this._processes.forEach(p => {
      if (p.sources.has(uri)) {
        nullthrows(p.sources.get(uri)).available = false;
      }
    });
    this._emitter.emit(CALLSTACK_CHANGED);
  }

  dispose(): void {
    this._disposables.dispose();
  }
}
