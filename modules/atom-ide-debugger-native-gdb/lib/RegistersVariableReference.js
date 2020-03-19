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
import {
  toCommandError,
  dataEvaluateExpressionResult,
  dataListRegisterNamesResult,
  dataListRegisterValuesResult,
} from './MITypes';
import MIProxy from './MIProxy';
import {MIRegisterValue, MIRegisterValueParser} from './MIRegisterValue';
import VariableReference from './VariableReference';

export default class RegistersVariableReference extends VariableReference {
  _registerIndices: Array<number>;
  _registerNames: Map<number, string>;

  constructor(client: MIProxy, variables: Variables) {
    super({
      client,
      variables,
      expression: '',
      typeClass: 'named',
      type: 'register-file',
    });
  }

  async getVariables(start: ?number, count: ?number): Promise<Array<Variable>> {
    const resolvedStart = start == null ? 0 : start;
    const resolvedCount = count == null ? await this.getChildCount() : count;

    await this._ensureRegisterIndicesExist();
    const indices = this._registerIndices.slice(
      resolvedStart,
      resolvedStart + resolvedCount,
    );

    const result = await this._client.sendCommand(
      `data-list-register-values --skip-unavailable x ${indices.join(' ')}`,
    );

    if (result.error) {
      throw new Error(
        `Could not fetch register values ${toCommandError(result).msg}`,
      );
    }

    return dataListRegisterValuesResult(result)['register-values'].map(_ => {
      const name = this._registerNames.get(parseInt(_.number, 10));
      invariant(name != null);

      const value = new MIRegisterValueParser(_.value).parse();

      return RegistersVariableReference.variableFromRegisterValue(
        this._variables,
        name,
        `$${name}`, // registers are denoted $reg in gdb expressions
        value,
      );
    });
  }

  static variableFromRegisterValue(
    variables: Variables,
    name: string,
    expression: string,
    value: MIRegisterValue,
  ): Variable {
    let variable: Variable = {
      name,
      value: value.toString(),
      type: 'int',
      variablesReference: 0,
    };

    if (value.isContainer()) {
      const varref = variables.registerElementVariableReference(
        value,
        name,
        expression,
      );

      if (value.containerKeyIsString) {
        variable = {
          ...variable,
          type: '{}',
          variablesReference: varref,
          namedVariables: value.length,
          presentationHint: {
            kind: 'readOnly',
          },
        };
      } else {
        variable = {
          ...variable,
          type: '[]',
          variablesReference: varref,
          indexedVariables: value.length,
          presentationHint: {
            kind: 'readOnly',
          },
        };
      }
    }

    return variable;
  }

  async getType(): Promise<string> {
    return '[]';
  }

  // The value of a container variable is a summary of the value
  // of its contents.
  async getValue(): Promise<string> {
    return '...';
  }

  async getChildCount(): Promise<number> {
    await this._ensureRegisterIndicesExist();
    return this._registerIndices.length;
  }

  async _ensureRegisterIndicesExist(): Promise<void> {
    if (this._registerIndices != null) {
      return;
    }

    // MI indexes registers, but the indices aren't contiguous so that the
    // indices can match the target CPU's numbering scheme if there is one.
    // This is represented in the API by empty register names for unused
    // slots.
    this._registerNames = new Map();
    this._registerIndices = [];

    const result = await this._client.sendCommand('data-list-register-names');
    if (result.error) {
      throw new Error(
        `Failed to fetch register names ${toCommandError(result).msg}`,
      );
    }

    dataListRegisterNamesResult(result)['register-names'].forEach(
      (name, index) => {
        if (name !== '') {
          this._registerIndices.push(index);
          this._registerNames.set(index, name);
        }
      },
    );
  }

  async setChildValue(name: string, value: string): Promise<SetChildResponse> {
    const result = await this._client.sendCommand(
      `data-evaluate-expression $${name}=${value}`,
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

  get qualifiedName(): string {
    return 'registers';
  }

  get needsDeletion(): boolean {
    return false;
  }
}
