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

import type {SetChildResponse} from './VariableReference';
import type {Variable} from 'vscode-debugprotocol';

import invariant from 'assert';
import MIProxy from './MIProxy';
import {
  stackListVariablesResult,
  toCommandError,
  varAssignResult,
  varCreateResult,
} from './MITypes';
import VariableReference from './VariableReference';

// a ScopeVariableReference refers to a set of variables in a stack frame
export default class ScopeVariableReference extends VariableReference {
  constructor(
    client: MIProxy,
    variables: Variables,
    threadId: number,
    frameIndex: number,
  ) {
    super({
      client,
      variables,
      expression: '',
      threadId,
      frameIndex,
      typeClass: 'named',
      type: 'scope',
    });
  }

  async getVariables(start: ?number, count: ?number): Promise<Array<Variable>> {
    // By definition, a scope variable must have a stack frame.
    invariant(this.threadId != null);
    invariant(this.frameIndex != null);

    const command = `stack-list-variables --thread ${this.threadId} --frame ${
      this.frameIndex
    } --no-values`;
    const result = await this._client.sendCommand(command);
    if (result.error) {
      throw new Error(
        `Error retrieving variables for stack frame (${
          toCommandError(result).msg
        })`,
      );
    }

    const miVariables = stackListVariablesResult(result).variables;

    const resolvedStart = start == null ? 0 : start;
    const resolvedEnd =
      count == null ? miVariables.length - resolvedStart : start + count;

    return Promise.all(
      miVariables.slice(resolvedStart, resolvedEnd).map(async _ => {
        const handle = this._variables.nestedVariableReference(this, _.name);

        return this.variableFromVarRefHandle(handle, _.name, null);
      }),
    );
  }

  async setChildValue(name: string, value: string): Promise<SetChildResponse> {
    const varResult = await this._client.sendCommand(`var-create - * ${name}`);
    if (varResult.error) {
      throw new Error(
        `Could not get variable ${name} to set: ${
          toCommandError(varResult).msg
        }`,
      );
    }

    const varInfo = varCreateResult(varResult);

    const assignResult = await this._client.sendCommand(
      `var-assign ${varInfo.name} ${value}`,
    );
    if (assignResult.error) {
      throw new Error(
        `Unable to set ${name} to {value}: ${toCommandError(assignResult).msg}`,
      );
    }

    const assign = varAssignResult(assignResult);

    await this._client.sendCommand(`var-delete ${varInfo.name}`);

    return {
      value: assign.value,
      type: varInfo.type,
      variablesReference: 0,
    };
  }

  async getValue(): Promise<string> {
    return '';
  }

  get qualifiedName(): string {
    return 'scope';
  }

  async getChildCount(): Promise<number> {
    if (this._childCount != null) {
      return this._childCount;
    }

    const variables = await this.getVariables();
    this._childCount = variables.length;
    return variables.length;
  }
}
