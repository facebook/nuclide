/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import * as DebugProtocol from 'vscode-debugprotocol';

import Breakpoint from './Breakpoint';
import Thread from './Thread';
import ThreadCollection from './ThreadCollection';

export const STACK_FRAME_FOCUS_CHANGED = 'stack-frame-focus-changed';
export const THREAD_FOCUS_CHANGED = 'thread-focus-changed';

export type VariablesInScope = {
  expensive: boolean,
  scopeName: string,
  variables?: DebugProtocol.Variable[],
};

export type BreakpointSetResult = {
  index: number,
  message: ?string,
};

export interface DebuggerInterface {
  run(): Promise<void>;
  getThreads(): ThreadCollection;
  setActiveThreadId(thread: number): void;
  getActiveThread(): Thread;
  stepIn(): Promise<void>;
  stepOver(): Promise<void>;
  stepOut(): Promise<void>;
  continue(): Promise<void>;
  getStackTrace(
    thread: number,
    levels: number,
  ): Promise<DebugProtocol.StackFrame[]>;
  setSelectedStackFrame(thread: Thread, frameIndex: number): Promise<void>;
  getCurrentStackFrame(): Promise<?DebugProtocol.StackFrame>;
  getVariablesByScope(selectedScope: ?string): Promise<VariablesInScope[]>;
  getVariablesByReference(ref: number): Promise<DebugProtocol.Variable[]>;
  supportsStoppedAtBreakpoint(): boolean;
  getStoppedAtBreakpoint(): ?Breakpoint;
  setSourceBreakpoint(
    path: string,
    line: number,
    once: boolean,
    condition: ?string,
  ): Promise<BreakpointSetResult>;
  setFunctionBreakpoint(
    func: string,
    once: boolean,
    condition: ?string,
  ): Promise<BreakpointSetResult>;
  getAllBreakpoints(): Breakpoint[];
  getBreakpointByIndex(index: number): Breakpoint;
  setAllBreakpointsEnabled(enabled: boolean): Promise<void>;
  setBreakpointEnabled(bpt: Breakpoint, enabled: boolean): Promise<void>;
  deleteAllBreakpoints(): Promise<void>;
  deleteBreakpoint(bpt: Breakpoint): Promise<void>;
  toggleAllBreakpoints(): Promise<void>;
  toggleBreakpoint(bpt: Breakpoint): Promise<void>;
  getSourceLines(
    source: DebugProtocol.Source,
    start: number,
    length: number,
  ): Promise<string[]>;
  relaunch(): Promise<void>;
  evaluateExpression(
    expression: string,
    isBlockOfCode: boolean,
  ): Promise<DebugProtocol.EvaluateResponse>;
  supportsCodeBlocks(): boolean;
  adapterCaps(): DebugProtocol.Capabilities;
  info(expression: string): Promise<DebugProtocol.InfoResponse>;
  getCompletions(
    text: string,
    column: number,
  ): Promise<Array<DebugProtocol.CompletionItem>>;
}
