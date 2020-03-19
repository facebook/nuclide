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

import child_process from 'child_process';
import {logger} from 'vscode-debugadapter';

export const PROMPT = '(ocd) ';

function stripPrompt(s: string): string {
  return s.substr(0, s.length - PROMPT.length);
}

export type DebugFinishedResults =
  | {kind: 'finished'}
  | {kind: 'error', message: string};

export class OCamlDebugProxy {
  _debuggerProcess: child_process$ChildProcess;
  _programFinishedCallback: DebugFinishedResults => void;

  constructor(
    command: string,
    debuggerArguments: Array<string>,
    programFinishedCallback: DebugFinishedResults => void,
  ) {
    this._programFinishedCallback = programFinishedCallback;

    logger.verbose(`Running "${command} ${debuggerArguments.join(' ')}"`);
    this._debuggerProcess = child_process.spawn(command, debuggerArguments);

    this._debuggerProcess.stdout.on('data', data => {
      logger.verbose(`STDOUT:${data.toString()}`);
    });

    this._debuggerProcess.stderr.on('data', data => {
      const dataString = data.toString();
      logger.verbose(`STDERR:${dataString}`);
      if (/^Program not found\.$/m.test(dataString)) {
        logger.error(dataString);
        this._programFinishedCallback({
          kind: 'error',
          message: `Invalid executable path ${command}`,
        });
      }
    });
  }

  attachOnPromptListener(onBreak: (s: string) => void): () => void {
    let buffer = '';
    const onData = data => {
      buffer += data;
      if (buffer.endsWith(PROMPT)) {
        this._debuggerProcess.stdout.removeListener('data', onData);
        onBreak(stripPrompt(buffer));
      }
    };
    this._debuggerProcess.stdout.on('data', onData);
    return () => {
      this._debuggerProcess.stdout.removeListener('data', onData);
    };
  }

  kill() {
    this._debuggerProcess.kill();
  }

  async pause(): Promise<void> {
    this._debuggerProcess.kill('SIGINT');
    await this.waitForPrompt();
  }

  async resume(): Promise<void> {
    await this.send('run');
  }

  send(command: string): Promise<string> {
    logger.verbose(`STDIN:${command}`);
    this._debuggerProcess.stdin.write(`${command}\n`);
    return this.waitForPrompt();
  }

  waitForPrompt(): Promise<string> {
    return new Promise((resolve, reject) => {
      const dispose = this.attachOnPromptListener(data => {
        if (data.match(/Time: \d+\nProgram exit.\n?$/)) {
          this._programFinishedCallback({kind: 'finished'});
        }

        dispose();
        resolve(data);
      });
    });
  }
}
