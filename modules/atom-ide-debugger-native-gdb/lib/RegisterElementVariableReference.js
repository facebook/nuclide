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

import type {MINamedRegisterValue} from './MIRegisterValue';
import type {SetChildResponse} from './VariableReference';
import type {Variable} from 'vscode-debugprotocol';
import type {VariableTypeClass} from './VariableReference';
import type {VariablesInterface} from './VariablesInterface';

import invariant from 'assert';
import MIProxy from './MIProxy';
import {MIRegisterValue} from './MIRegisterValue';
import RegistersVariableReference from './RegistersVariableReference';
import {toCommandError, dataEvaluateExpressionResult} from './MITypes';
import VariableReference from './VariableReference';

export default class RegisterElementVariableReference extends VariableReference {
  _value: MIRegisterValue;
  _name: string;
  _containedVariables: Array<Variable>;
  _childrenByName: Map<string, MINamedRegisterValue>;

  constructor(
    client: MIProxy,
    variables: VariablesInterface,
    name: string,
    expression: string,
    value: MIRegisterValue,
  ) {
    super({client, variables, expression});
    this._value = value;
    this._name = name;

    this._containedVariables = this._value.containedValues().map(v => {
      return RegistersVariableReference.variableFromRegisterValue(
        this._variables,
        v.name,
        `${this._expression}${v.expressionSuffix}`,
        v.value,
      );
    });

    this._childrenByName = new Map(
      this._value.containedValues().map(v => [v.name, v]),
    );
  }

  async getVariables(start: ?number, count: ?number): Promise<Array<Variable>> {
    const resolvedStart = start == null ? 0 : start;
    const resolvedCount = count == null ? await this.getChildCount() : count;

    return this._containedVariables.slice(
      resolvedStart,
      resolvedStart + resolvedCount,
    );
  }

  async getTypeClass(value: string): Promise<VariableTypeClass> {
    if (!this._value.isContainer()) {
      return 'simple';
    }

    if (this._value.containerKeyIsString) {
      return 'named';
    }

    return 'indexed';
  }

  async getType(): Promise<string> {
    if (!this._value.isContainer()) {
      return 'int';
    }
    return '[]';
  }

  async getValue(): Promise<string> {
    return this._value.toString();
  }

  async getChildCount(): Promise<number> {
    return this._value.length;
  }

  async setChildValue(name: string, value: string): Promise<SetChildResponse> {
    const nestedValue = this._childrenByName.get(name);
    invariant(nestedValue != null);

    if (nestedValue.value.isContainer()) {
      throw new Error(
        'Cannot edit aggregate value directly, please edit individual components.',
      );
    }

    const result = await this._client.sendCommand(
      `data-evaluate-expression ${this._expression}${
        nestedValue.expressionSuffix
      }=${value}`,
    );
    if (result.error) {
      throw new Error(
        `Unable to change register value ${toCommandError(result).msg}`,
      );
    }

    const newValue = dataEvaluateExpressionResult(result).value;

    return {
      value: newValue,
      type: await this.getType(),
    };
  }

  get needsDeletion(): boolean {
    return false;
  }
}
