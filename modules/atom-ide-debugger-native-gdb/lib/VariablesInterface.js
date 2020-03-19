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

import {MIRegisterValue} from './MIRegisterValue';
import VariableReference from './VariableReference';

export interface VariablesInterface {
  clearCachedVariables(): Promise<void>;
  variableReferenceForStackFrame(frameId: number): number;
  registersVariableReference(): ?number;
  registerElementVariableReference(
    value: MIRegisterValue,
    name: string,
    expression: string,
  ): number;
  nestedVariableReference(
    container: VariableReference,
    exp: string,
    name: ?string,
  ): number;
  expressionVariableReference(
    threadId: ?number,
    frameIndex: ?number,
    expression: string,
  ): number;
  getVariableReference(handle: number): ?VariableReference;
  getVariables(
    varrefHandle: number,
    start: ?number,
    count: ?number,
  ): Promise<Array<Variable>>;
}
