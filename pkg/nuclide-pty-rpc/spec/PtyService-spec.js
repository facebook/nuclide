/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 */

import invariant from 'assert';

import {spawn} from '../lib/PtyService';
import {PtyClient} from '../rpc-types';

describe('PtyService', () => {
  describe('spawn', () => {
    let ptyInfo;
    let runner;

    beforeEach(() => {
      ptyInfo = {
        terminalType: 'xterm',
        command: {
          file: '',
          args: [],
        },
      };
      runner = new LocalRunner();
    });

    it('adds numbers in bash', () => {
      waitsForPromise(async () => {
        invariant(ptyInfo.command != null);
        ptyInfo.command.file = '/bin/bash';
        ptyInfo.command.args = ['--norc', '-c', 'echo $((1 + 1))'];
        await spawn(ptyInfo, runner);
        const result = await runner.promise;
        expect(result.output.trim()).toBe('2');
        expect(result.code).toBe(0);
      });
    });
  });
});

type PtyResult = {
  output: string,
  code: number,
  signal: number,
};

class LocalRunner implements PtyClient {
  promise: Promise<PtyResult>;
  _output: string;
  _resolve: (result: PtyResult) => void;

  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this._resolve = resolve;
    });
    this._output = '';
  }

  onOutput(data: string): void {
    this._output += data;
  }

  onExit(code: number, signal: number): void {
    this._resolve({output: this._output, code, signal});
  }

  dispose() {}
}
