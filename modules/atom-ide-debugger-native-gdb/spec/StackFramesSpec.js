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

import type {Value} from '../lib/MIRecord';

import invariant from 'assert';
import StackFrames from '../lib/StackFrames';
import MIProxy from '../lib/MIProxy';
import {MIResultRecord} from '../lib/MIRecord';

// The mock class emulates the MI behavior of stack-info-depth and stack-list-frames
class MIProxyMock extends MIProxy {
  _fakeStackData: Map<number, Array<Value>>; // thread-id -> stack data

  constructor() {
    super();
    this._fakeStackData = new Map([
      [
        1,
        [
          {
            // A frame that has symbols
            frame: {
              level: '0',
              addr: '0x000000010000a042',
              func: 'main',
              file: 'ring_singleton.c',
              fullname: '/home/sauron/git/ring_singleton.c',
              line: '394',
            },
          },
          {
            // A frame that's in the runtime w/o symbols
            frame: {
              level: '1',
              addr: '0x0000000100cf5617',
              func: '??',
            },
          },
          {
            // A frame that's in the runtime w/o symbols
            frame: {
              level: '2',
              addr: '0x0000000102cf5617',
              func: '??',
              from: 'libc.so',
            },
          },
        ],
      ],
      [
        2,
        [
          {
            // A frame that has symbols
            frame: {
              level: '0',
              addr: '0x000000010000f00d',
              func: 'main',
              file: 'dwarf_ring.c',
              fullname: '/home/sauron/git/dwarf_ring.c',
              line: '79',
            },
          },
          {
            // A frame that has symbols
            frame: {
              level: '1',
              addr: '0x00000001000ab5fc',
              func: 'ring_timeslice',
              file: 'ring_dispatch.c',
              fullname: '/home/sauron/git/ring_dispatch.c',
              line: '79',
            },
          },
          {
            // A frame that's in the runtime w/o symbols
            frame: {
              level: '2',
              addr: '0x0000000100141593',
              func: '??',
            },
          },
          {
            // A frame that's in the runtime w/o symbols
            frame: {
              level: '3',
              addr: '0x0000000102fffffe',
              func: '??',
              from: 'libc.so',
            },
          },
        ],
      ],
    ]);
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

      if (op === 'stack-info-depth') {
        const depthArgs = args.match(/^--thread ([0-9]+)$/);
        if (depthArgs != null) {
          const [, thread] = depthArgs;
          invariant(thread != null);

          const threadId = parseInt(thread, 10);
          const stackData = this._fakeStackData.get(threadId);
          if (stackData == null) {
            result = new MIResultRecord(
              null,
              {
                msg: `Invalid thread id: ${threadId}`,
              },
              'error',
            );
          } else {
            result = new MIResultRecord(
              null,
              {
                depth: `${stackData.length}`,
              },
              'done',
            );
          }
        }
      } else if (op === 'stack-list-frames') {
        const listArgs = args.match(
          /^--thread ([0-9]+) --no-frame-filters ([0-9]+) ([0-9]+)$/,
        );
        if (listArgs != null) {
          const [, thread, lowFrame, highFrame] = listArgs;
          invariant(thread != null);
          invariant(lowFrame != null);
          invariant(highFrame != null);

          const threadId = parseInt(thread, 10);
          const low = parseInt(lowFrame, 10);
          const high = parseInt(highFrame, 10);

          const stackData = this._fakeStackData.get(threadId);

          if (stackData == null) {
            result = new MIResultRecord(
              null,
              {
                msg: `Invalid thread id: ${threadId}`,
              },
              'error',
            );
          } else if (low >= stackData.length) {
            result = new MIResultRecord(
              null,
              {msg: '-stack-list-frames: Not enough frames in stack.'},
              'error',
            );
          } else {
            const stack = stackData.slice(low, high + 1);
            result = new MIResultRecord(null, {stack}, 'done');
          }
        }
      }
    }

    return result;
  }
}

describe('StackFrames', () => {
  let proxy: MIProxyMock;
  let stackFrames: StackFrames;

  beforeEach(() => {
    proxy = new MIProxyMock();
    stackFrames = new StackFrames(proxy);
  });

  it('should return stack frames', done => {
    stackFrames
      .stackFramesForThread(1)
      .then(body => {
        expect(body.totalFrames).toBe(3);
        expect(body.stackFrames.length).toBe(3);

        expect(body.stackFrames[0].id).toBeDefined();
        expect(body.stackFrames[0].name).toBe('main');
        expect(body.stackFrames[0].source).toBeDefined();
        expect(body.stackFrames[0].source.name).toBe('ring_singleton.c');
        expect(body.stackFrames[0].source.path).toBe(
          '/home/sauron/git/ring_singleton.c',
        );
        expect(body.stackFrames[0].line).toBe(394);
        expect(body.stackFrames[0].column).toBe(0);

        expect(body.stackFrames[1].id).toBeDefined();
        expect(body.stackFrames[1].name).toBe('??');
        expect(body.stackFrames[1].source).toBeUndefined();
        expect(body.stackFrames[1].line).toBe(0);
        expect(body.stackFrames[1].column).toBe(0);

        expect(body.stackFrames[2].id).toBeDefined();
        expect(body.stackFrames[2].name).toBe('??');
        expect(body.stackFrames[2].source).toBeUndefined();
        expect(body.stackFrames[2].line).toBe(0);
        expect(body.stackFrames[2].column).toBe(0);

        done();
      })
      .catch(error => {
        expect(true).toBe(false, error.message);
        done();
      });
  });

  it('should return selected stack frames', done => {
    stackFrames
      .stackFramesForThread(2, 1, 1)
      .then(body => {
        expect(body.totalFrames).toBe(4);
        expect(body.stackFrames.length).toBe(1);

        expect(body.stackFrames[0].id).toBeDefined();
        expect(body.stackFrames[0].name).toBe('ring_timeslice');
        expect(body.stackFrames[0].source).toBeDefined();
        expect(body.stackFrames[0].source.name).toBe('ring_dispatch.c');
        expect(body.stackFrames[0].source.path).toBe(
          '/home/sauron/git/ring_dispatch.c',
        );
        expect(body.stackFrames[0].line).toBe(79);
        expect(body.stackFrames[0].column).toBe(0);

        done();
      })
      .catch(error => {
        expect(true).toBe(false, error.message);
        done();
      });
  });
});
