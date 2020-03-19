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

import type {CachedStackFrame} from '../lib/StackFrames';

import MIProxy from '../lib/MIProxy';
import {MIResultRecord} from '../lib/MIRecord';
import StackFrames from '../lib/StackFrames';
import Variables from '../lib/Variables';

class MockStackFrames extends StackFrames {
  stackFrameByHandle(handle: number): ?CachedStackFrame {
    return {
      threadId: 1,
      frameIndex: 0,
    };
  }
}

type StoredVar = {
  value: string,
  type: string,
};

// The mock class emulates the MI behavior of stack-list-variables
class MIProxyMock extends MIProxy {
  _nextVar = 1;
  _vars: Map<string, StoredVar> = new Map();

  constructor() {
    super();
  }

  async sendCommand(command: string): Promise<MIResultRecord> {
    let result: MIResultRecord = new MIResultRecord(
      null,
      {msg: `Invalid command "${command}"`},
      'error',
    );

    const match = command.match(/^([^ ]+) *(.*)$/);

    if (match != null) {
      const [, op, args] = match;

      if (op === 'stack-list-variables') {
        const listArgs = args.match(
          /^--thread ([0-9]+) --frame ([0-9]+) --no-values$/,
        );
        if (listArgs != null) {
          const vars = {
            variables: [
              {name: 'intval', value: '42', type: 'int'},
              {name: 'structval', type: 'mystruct'},
            ],
          };

          result = new MIResultRecord(null, vars, 'done');
        }
      } else if (op === 'var-create') {
        const varCreateArgs = args.match(
          /^--thread ([0-9]+) --frame ([0-9]+) - [@*] (.*)$/,
        );
        if (varCreateArgs != null) {
          const [, thread, , exp] = varCreateArgs;
          const name = `var${this._nextVar++}`;
          const created = {
            name,
            numchild: '0',
            value: exp === 'intval' ? '42' : '...',
            type: exp === 'intval' ? 'int' : 'mystruct',
            'thread-id': thread,
            has_more: '0',
          };

          this._vars.set(created.name, {
            value: created.value,
            type: created.type,
          });

          result = new MIResultRecord(null, created, 'done');
        }
      } else if (op === 'var-evaluate-expression') {
        const value = this._vars.get(args);
        const body = {
          value: value == null ? '??' : value.value,
        };

        result = new MIResultRecord(null, body, 'done');
      } else if (op === 'var-info-type') {
        const value = this._vars.get(args);
        const body = {
          type: value == null ? '??' : value.type,
        };

        result = new MIResultRecord(null, body, 'done');
      }
    }

    return result;
  }
}

describe('Variables', () => {
  let proxy: MIProxyMock;
  let stackFrames: MockStackFrames;
  let variables: Variables;

  beforeEach(() => {
    proxy = new MIProxyMock();
    stackFrames = new MockStackFrames(proxy);
    variables = new Variables(proxy, stackFrames);
  });

  it('getVariables() should return variables', done => {
    const varref = variables.variableReferenceForStackFrame(1000);
    variables
      .getVariables(varref)
      .then(vars => {
        expect(vars.length).toBe(2);

        expect(vars[0].name).toBe('intval');
        expect(vars[0].type).toBe('int');
        expect(vars[0].value).toBe('42');
        expect(vars[0].variablesReference).toBe(0);

        expect(vars[1].name).toBe('structval');
        expect(vars[1].type).toBe('mystruct');
        expect(vars[1].value).toBe('...');

        // $$TODO when indexed variables are supported
        // expect(vars[1].variablesReference !== 0).toBeTruthy();

        done();
      })
      .catch(error => {
        expect(true).toBe(false, error.message);
        done();
      });
  });
});
