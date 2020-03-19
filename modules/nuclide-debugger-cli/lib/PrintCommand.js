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

import type {Command} from './Command';
import type {ConsoleIO} from './ConsoleIO';

import * as DebugProtocol from 'vscode-debugprotocol';
import {DebuggerInterface} from './DebuggerInterface';
import TokenizedLine from './TokenizedLine';

export default class PrintCommand implements Command {
  name = 'print';
  helpText =
    'expr: Prints the result of an expression in the context of the current stack frame.';
  detailedHelpText = `
print expression

Displays the value of an expression. The expression will be evaluated in the syntax
of the program's language.

The expression will be evaluated in the context of the selected stack frame. See
'backtrace' for how to set the selected frame.

The expression may have side effects, in which case program state will be modified.
For example,

print x = 5

is a convenient way to set the value of 'x' to 5. Also, since a function call is
an expression, any in-scope function may be called, which may modify program state
in complex ways.
  `;

  _console: ConsoleIO;
  _debugger: DebuggerInterface;

  constructor(con: ConsoleIO, debug: DebuggerInterface) {
    this._console = con;
    this._debugger = debug;
  }

  async execute(line: TokenizedLine): Promise<void> {
    const expr = line.rest(1);
    try {
      const {
        body: {result, variablesReference, namedVariables, indexedVariables},
      } = await this._debugger.evaluateExpression(expr, false);
      if (variablesReference > 0) {
        this._console.outputLine(
          await this.formatVariable(
            {
              name: '',
              value: result,
              variablesReference,
              namedVariables: namedVariables == null ? 0 : namedVariables,
              indexedVariables: indexedVariables == null ? 0 : indexedVariables,
            },
            0,
          ),
        );
      } else {
        this._console.outputLine(result);
      }
    } catch (err) {
      this._console.outputLine(err.message);
    }
  }

  async formatVariable(
    v: DebugProtocol.Variable,
    depth: number,
  ): Promise<string> {
    if (depth > 4) {
      return '...';
    }
    if (v.variablesReference != null && v.variablesReference !== 0) {
      if (
        (v.indexedVariables === 0 || v.indexedVariables == null) &&
        (v.namedVariables === 0 || v.namedVariables == null)
      ) {
        return '[]';
      }

      const children = await this._debugger.getVariablesByReference(
        v.variablesReference,
      );
      const childValues = await Promise.all(
        children.map(child => this.formatVariable(child, depth + 1)),
      );
      let formatted = '';
      formatted += `${' '.repeat(depth)}[\n`;
      for (let index = 0; index < children.length; index++) {
        formatted += `${' '.repeat(depth + 1)}${children[index].name} => ${
          childValues[index]
        },\n`;
      }
      formatted += `${' '.repeat(depth)}]`;
      return formatted;
    }

    return v.value;
  }
}
