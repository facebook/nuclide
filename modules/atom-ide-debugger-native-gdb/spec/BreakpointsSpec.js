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

import Breakpoints from '../lib/Breakpoints';
import SourceBreakpoints from '../lib/SourceBreakpoints';
import MIProxy from '../lib/MIProxy';
import {MIResultRecord} from '../lib/MIRecord';

type Command = {
  operation: 'insert' | 'delete' | 'invalid',
  invalid: string,
  ids: Array<number>,
  path: string,
  line: number,
};

// The mock class emulates the MI behavior of break-insert and break-delete,
// including a mapping of ids on the debugger side for each breakpoint.
class MIProxyMock extends MIProxy {
  _sentCommands: Array<Command>;
  _nextId: number;
  _idsByLine: Map<number, number>;

  constructor() {
    super();
    this._sentCommands = [];
    this._nextId = 1;
    this._idsByLine = new Map();
  }

  isConnected() {
    return true;
  }

  async sendCommand(command: string): Promise<MIResultRecord> {
    let parsedCommand = {
      operation: 'invalid',
      invalid: command,
      ids: [],
      path: '',
      line: -1,
    };

    let result: MIResultRecord = new MIResultRecord(null, {}, 'error');

    const match = command.match(/^([^ ]+) *(.*)$/);

    if (match != null) {
      const [, op, args] = match;

      if (op === 'break-delete') {
        const ids = args
          .split(/ +/)
          .filter(_ => _.length !== 0)
          .map(_ => parseInt(_, 10));

        this._idsByLine = new Map(
          [...this._idsByLine].filter(_ => !ids.includes(_[1])),
        );

        parsedCommand = {
          ...parsedCommand,
          operation: 'delete',
          ids,
        };

        result = new MIResultRecord(null, {}, 'done');
      } else if (op === 'break-insert') {
        const insertArgs = args.match(/^-f --source (.*) --line ([0-9]+)\s*$/);
        if (insertArgs != null) {
          const [, path, lineStr] = insertArgs;
          const line = parseInt(lineStr, 10);
          parsedCommand = {
            ...parsedCommand,
            operation: 'insert',
            path,
            line,
          };

          const id = this._nextId++;
          this._idsByLine.set(line, id);

          result = new MIResultRecord(
            null,
            {
              bkpt: [
                {
                  number: `${id}`,
                  type: 'breakpoint',
                  disp: 'keep',
                  enabled: 'y',
                  addr: '0x0000000100000eff',
                  func: 'main',
                  file: path,
                  fullname: path,
                  line: `${line}`,
                  'thread-groups': ['i1'],
                  times: '0',
                  'original-location': `${path}:${line}`,
                },
              ],
            },
            'done',
          );
        }
      }
    }

    this.sentCommands.push(parsedCommand);

    return result;
  }

  clearCommands(): void {
    this._sentCommands = [];
  }

  idForLine(line: number): ?number {
    return this._idsByLine.get(line);
  }

  get sentCommands(): Array<Command> {
    return this._sentCommands;
  }
}

describe('Breakpoints', () => {
  let proxy: MIProxyMock;
  let breakpoints: SourceBreakpoints;

  beforeEach(() => {
    proxy = new MIProxyMock();
    breakpoints = new SourceBreakpoints(proxy, new Breakpoints());
  });

  it('should set a breakpoint', done => {
    breakpoints.setSourceBreakpoints('foo.c', [{line: 42}]).then(bkptsOut => {
      const invalid = proxy.sentCommands.filter(_ => _.operation === 'invalid');
      expect(invalid.length).toEqual(
        0,
        `Should not have any invalid commands (${JSON.stringify(invalid)})`,
      );

      const deletes = proxy.sentCommands.filter(_ => _.operation === 'delete');
      expect(deletes.length).toEqual(
        0,
        `Should not have any breakpoint delete commands (${JSON.stringify(
          deletes,
        )})`,
      );

      const inserts = proxy.sentCommands.filter(_ => _.operation === 'insert');
      expect(inserts.length).toEqual(
        1,
        `Should have exactly one breakpoint insert command (${JSON.stringify(
          inserts,
        )})`,
      );

      const insert = inserts[0];
      expect(insert).toBeDefined();

      expect(insert.path).toEqual('foo.c');
      expect(insert.line).toEqual(42);

      expect(bkptsOut.length).toEqual(1, 'Should return one breakpoint');

      expect(bkptsOut[0].line).toEqual(
        42,
        'The returned breakpoint map should have our line in it',
      );

      done();
    });
  });

  it('should send multiple inserts for multiple breakpoints', done => {
    const lines = [4, 8, 15, 16, 23, 42];
    const breakpointsIn = lines.map(_ => {
      return {line: _};
    });
    breakpoints
      .setSourceBreakpoints('island.c', breakpointsIn)
      .then(bkptsOut => {
        const inserts = proxy.sentCommands.filter(
          _ => _.operation === 'insert',
        );
        expect(inserts.length).toEqual(
          lines.length,
          `Should have exactly ${
            lines.length
          } breakpoint insert commands (${JSON.stringify(inserts)})`,
        );

        // we don't impose that the commands are done in any sort of order
        inserts.sort((left, right) => left.line - right.line);

        for (let i = 0; i < lines.length; i++) {
          expect(inserts[i]).toBeDefined(
            'There should be one insert command per line',
          );
          expect(inserts[i].path).toEqual(
            'island.c',
            'The insert command should have the proper file',
          );
          expect(inserts[i].line).toEqual(
            lines[i],
            'The insert command should have the proper line',
          );
        }

        expect(bkptsOut.length).toEqual(
          lines.length,
          'The returned handle map should have all of the given lines',
        );

        for (const line of lines) {
          const bkpt = bkptsOut.find(_ => _.line === line);

          expect(bkpt).toBeDefined(
            'Each given line should be in the returned array',
          );
        }

        done();
      });
  });

  it('should send one delete command for multiple breakpoints', done => {
    const lines = [4, 8, 15, 16, 23, 42];
    const breakpointsIn = lines.map(_ => {
      return {line: _};
    });
    breakpoints
      .setSourceBreakpoints('island.c', breakpointsIn)
      .then(bkptsOut => {
        proxy.clearCommands();

        for (const line of lines) {
          const bkpt = bkptsOut.find(_ => _.line === line);
          expect(bkpt).toBeDefined(
            'Each given line should be in the handle map',
          );
        }

        const linesToRemove = [8, 42];
        const newLines = lines.filter(_ => !linesToRemove.includes(_));
        const idsToRemove = linesToRemove.map(_ => proxy.idForLine(_));

        const newBreakpointsIn = newLines.map(_ => {
          return {line: _};
        });
        breakpoints
          .setSourceBreakpoints('island.c', newBreakpointsIn)
          .then(newMap => {
            expect(proxy.sentCommands.length).toEqual(
              1,
              'All deletions should be done by a single command',
            );
            const command = proxy.sentCommands[0];
            expect(command).toBeDefined();
            expect(command.ids.length).toEqual(
              lines.length - newLines.length,
              'The delete command should cover all removed lines',
            );

            for (const id of idsToRemove) {
              expect(id).toBeDefined();
              expect(command.ids.includes(id)).toBeTruthy(
                'The gdb id of each removed breakpoint should be on the delete command',
              );
            }

            expect(newMap.length).toEqual(
              newLines.length,
              'The returned handle map should contain all remaining lines',
            );

            for (const line of newLines) {
              const bkpt = newMap.find(_ => _.line === line);
              expect(bkpt).toBeDefined(
                'All remaining lines should be returned',
              );
            }

            done();
          });
      });
  });
});
