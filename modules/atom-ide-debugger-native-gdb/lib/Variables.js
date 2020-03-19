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

import type {Variable} from 'vscode-debugprotocol';
import type {VariablesInterface} from './VariablesInterface';

import HandleMap from './HandleMap';
import MIProxy from './MIProxy';
import ExpressionVariableReference from './ExpressionVariableReference';
import {MIRegisterValue} from './MIRegisterValue';
import NestedVariableReference from './NestedVariableReference';
import RegisterElementVariableReference from './RegisterElementVariableReference';
import RegistersVariableReference from './RegistersVariableReference';
import ScopeVariableReference from './ScopeVariableReference';
import StackFrames from './StackFrames';
import VariableReference from './VariableReference';

export default class Variables implements VariablesInterface {
  _client: MIProxy;
  _frames: StackFrames;
  _variables: HandleMap<VariableReference>;
  _scopeIndex: Map<number, Map<number, number>>; // by thread, then frame index
  _nestedReferenceIndex: Map<number, Map<number, Map<string, number>>>; // by thread, frame index, varname
  _registerElementReferenceIndex: Map<string, number>; // by register expression
  _varsNeedingDeletion: Set<VariableReference>;
  _registersVariableReference: ?number;

  constructor(client: MIProxy, frames: StackFrames) {
    this._client = client;
    this._frames = frames;
    this._variables = new HandleMap();
    this._scopeIndex = new Map();
    this._nestedReferenceIndex = new Map();
    this._registerElementReferenceIndex = new Map();
    this._varsNeedingDeletion = new Set();
  }

  async clearCachedVariables(): Promise<void> {
    await Promise.all(
      [...this._varsNeedingDeletion].map(async _ => _.deleteResources()),
    );

    this._varsNeedingDeletion.clear();
    this._variables.clear();
    this._scopeIndex.clear();
    this._nestedReferenceIndex.clear();
    this._registerElementReferenceIndex.clear();
    this._registersVariableReference = null;
  }

  variableReferenceForStackFrame(frameId: number): number {
    const frame = this._frames.stackFrameByHandle(frameId);
    if (frame == null) {
      throw new Error(
        `Attempt to find or create varref for unknown stack frame ${frameId}`,
      );
    }

    let threadMap = this._scopeIndex.get(frame.threadId);
    if (threadMap == null) {
      threadMap = new Map();
      this._scopeIndex.set(frame.threadId, threadMap);
    }

    let varref = threadMap.get(frame.frameIndex);
    if (varref == null) {
      const scopeVarRef = new ScopeVariableReference(
        this._client,
        this,
        frame.threadId,
        frame.frameIndex,
      );
      varref = this._variables.put(scopeVarRef);
      threadMap.set(frame.frameIndex, varref);
    }

    return varref;
  }

  registersVariableReference(): ?number {
    if (this._registersVariableReference != null) {
      return this._registersVariableReference;
    }

    const varref = this._variables.put(
      new RegistersVariableReference(this._client, this),
    );

    this._registersVariableReference = varref;
    return varref;
  }

  registerElementVariableReference(
    value: MIRegisterValue,
    name: string,
    expression: string,
  ): number {
    let varref = this._registerElementReferenceIndex.get(expression);

    if (varref == null) {
      varref = this._variables.put(
        new RegisterElementVariableReference(
          this._client,
          this,
          name,
          expression,
          value,
        ),
      );
    }

    return varref;
  }

  nestedVariableReference(
    container: VariableReference,
    exp: string,
    name: ?string,
  ): number {
    const resolvedThreadId =
      container.threadId == null ? -1 : container.threadId;
    const resolvedFrameIndex =
      container.frameIndex == null ? -1 : container.frameIndex;

    let threadMap = this._nestedReferenceIndex.get(resolvedThreadId);
    if (threadMap == null) {
      threadMap = new Map();
      this._nestedReferenceIndex.set(resolvedThreadId, threadMap);
    }

    let frameMap = threadMap.get(resolvedFrameIndex);
    if (frameMap == null) {
      frameMap = new Map();
      threadMap.set(resolvedFrameIndex, frameMap);
    }

    const key = `${container.qualifiedName}.${exp}`;
    let handle = frameMap.get(key);
    if (handle != null) {
      return handle;
    }

    const varref = new NestedVariableReference(
      this._client,
      this,
      container,
      exp,
      name,
    );

    if (varref.needsDeletion) {
      this._varsNeedingDeletion.add(varref);
    }

    handle = this._variables.put(varref);

    frameMap.set(key, handle);
    return handle;
  }

  expressionVariableReference(
    threadId: ?number,
    frameIndex: ?number,
    expression: string,
  ): number {
    const resolvedThreadId = threadId == null ? -1 : threadId;
    const resolvedFrameIndex = frameIndex == null ? -1 : frameIndex;

    let threadMap = this._nestedReferenceIndex.get(resolvedThreadId);
    if (threadMap == null) {
      threadMap = new Map();
      this._nestedReferenceIndex.set(resolvedThreadId, threadMap);
    }

    let frameMap = threadMap.get(resolvedFrameIndex);
    if (frameMap == null) {
      frameMap = new Map();
      threadMap.set(resolvedFrameIndex, frameMap);
    }

    const key = `eval.${expression}`;
    let handle = frameMap.get(key);
    if (handle != null) {
      return handle;
    }

    const varref = new ExpressionVariableReference(
      this._client,
      this,
      threadId,
      frameIndex,
      expression,
    );

    if (varref.needsDeletion) {
      this._varsNeedingDeletion.add(varref);
    }

    handle = this._variables.put(varref);

    frameMap.set(key, handle);
    return handle;
  }

  getVariableReference(handle: number): ?VariableReference {
    return this._variables.getObjectByHandle(handle);
  }

  async getVariables(
    varrefHandle: number,
    start: ?number,
    count: ?number,
  ): Promise<Array<Variable>> {
    const varref = this._variables.getObjectByHandle(varrefHandle);
    if (varref == null) {
      throw new Error(`Attempt to access invalid varref ${varrefHandle}`);
    }

    return varref.getVariables(start, count);
  }
}
