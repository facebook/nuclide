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

import type {Variable} from 'vscode-debugprotocol';

import invariant from 'assert';
import MIProxy from './MIProxy';
import {toCommandError, varListChildrenResult} from './MITypes';
import VariableReference from './VariableReference';

// A NestedVariableReference refers to a set of variables in another variable
// (struct, union, etc.)
export default class NestedVariableReference extends VariableReference {
  _type: ?string;
  _qualifiedName: string;
  _needsDeletion: boolean;

  constructor(
    client: MIProxy,
    variables: Variables,
    container: VariableReference,
    expression: string, // exp is the expression in the source language naming the variable
    varName: ?string, // name is the internal gdb variable name, used to get the value
  ) {
    super({
      client,
      variables,
      expression,
      threadId: container.threadId,
      frameIndex: container.frameIndex,
      varName,
    });
    // We will lazily create the variable binding to MI, so we only
    // have to do it for ones the user actually wants to drill into.
    this._qualifiedName = container.qualifiedName + '.' + expression;

    // if name is null, then we will lazily create a gdb varref which needs
    // to be cleaned up. if name is defined then the varref is already
    // created and whoever did that is responsible for deleting it.
    this._needsDeletion = varName == null;
  }

  async getVariables(start: ?number, count: ?number): Promise<Array<Variable>> {
    if (this._varName == null) {
      await this._createVariableBinding(this._expression);
    }

    const varName = this._varName;
    invariant(varName != null);

    // var-list-children -no-values name from to (zero-based, from 'from and up to and including 'to')
    const command = `var-list-children --no-values ${varName}`;
    const result = await this._client.sendCommand(command);

    if (result.error) {
      throw new Error(
        `Error getting variable's children (${toCommandError(result).msg})`,
      );
    }

    const miVariables = varListChildrenResult(result).children;

    const resolvedStart = start == null ? 0 : start;
    const resolvedEnd =
      count == null ? miVariables.length - resolvedStart : start + count;

    return Promise.all(
      miVariables.slice(resolvedStart, resolvedEnd).map(async _ => {
        const child = _.child;

        const handle = this._variables.nestedVariableReference(
          this,
          child.exp,
          child.name,
        );

        return this.variableFromVarRefHandle(handle, child.exp, child.type);
      }),
    );
  }

  get needsDeletion(): boolean {
    return this._needsDeletion;
  }

  async _getVarName(): Promise<string> {
    if (this._varName != null) {
      return this._varName;
    }

    await this._createVariableBinding(this._expression);
    const varName = this._varName;
    invariant(varName != null);

    return varName;
  }

  get qualifiedName(): string {
    return this._qualifiedName;
  }
}
