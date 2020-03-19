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

import {logVerbose} from './Logger';
import MIProxy from './MIProxy';
import VariableReference from './VariableReference';

// An ExpressionVariableReference refers to a watch or hover expression rather
// than a variable rooted in a stack frame scope.
export default class ExpressionVariableReference extends VariableReference {
  constructor(
    client: MIProxy,
    variables: Variables,
    threadId: ?number,
    frameIndex: ?number,
    expression: string,
  ) {
    super({client, variables, expression, threadId, frameIndex});
  }

  // Unlike variable enumeration, getVariables here can only return exactly
  // one variable.
  async getVariables(start: ?number, count: ?number): Promise<Array<Variable>> {
    const value = await this.getValue();
    const typeClass = await this.getTypeClass(value);

    const resolvedType = await this.getType();

    logVerbose(
      `eval name ${
        this._expression
      } type ${resolvedType} value ${value} typeClass ${typeClass}`,
    );

    let variable: Variable = {
      name: this._expression,
      value,
      type: resolvedType,
      variablesReference: 0,
    };

    if (typeClass !== 'simple') {
      const handle = this._variables.nestedVariableReference(
        this,
        this._expression,
        await this._getVarName(),
      );
      const childCount = await this.getChildCount();

      if (typeClass === 'indexed') {
        variable = {
          ...variable,
          indexedVariables: childCount,
          variablesReference: handle,
        };
      } else if (typeClass === 'named') {
        variable = {
          ...variable,
          namedVariables: childCount,
          variablesReference: handle,
        };
      }
    }

    return [variable];
  }

  get needsDeletion(): boolean {
    return true;
  }

  get qualifiedName(): string {
    return `eval.${this._expression}`;
  }
}
