/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 */

import type {Breakpoint} from './BreakpointStore';
import type {DebuggerMode} from './types';

import dedent from 'dedent';
import child_process from 'child_process';
import url from 'url';
import logger from './utils';
import {getConfig} from './config';
import {shellParse} from '../../commons-node/string';
import {checkOutput} from '../../commons-node/process';

export const DUMMY_FRAME_ID = 'Frame.0';

export function isContinuationCommand(command: string): boolean {
  return [
    'run',
    'step_into',
    'step_over',
    'step_out',
    'stop',
    'detach',
  ].some(continuationCommand => continuationCommand === command);
}

export function isEvaluationCommand(command: string): boolean {
  return command === 'eval';
}

export function base64Decode(value: string): string {
  return new Buffer(value, 'base64').toString();
}

export function base64Encode(value: string): string {
  return new Buffer(value).toString('base64');
}

// Returns true if hphpd might be attached according to some heuristics applied to the process list.
export async function hphpdMightBeAttached(): Promise<boolean> {
  const processes = await checkOutput('ps', ['aux'], {});
  return processes.stdout.toString().split('\n').slice(1).some(line => {
    return line.indexOf('m debug') >= 0 // hhvm -m debug
      || line.indexOf('mode debug') >= 0; // hhvm --mode debug
  });
}

export function makeDbgpMessage(message: string): string {
  return String(message.length) + '\x00' + message + '\x00';
}

export function makeMessage(obj: Object, body_: ?string): string {
  let body = body_;
  body = body || '';
  let result = '<?xml version="1.0" encoding="iso-8859-1"?>' +
    '<response xmlns="urn:debugger_protocol_v1" xmlns:xdebug="http://xdebug.org/dbgp/xdebug"';
  for (const key in obj) {
    result += ' ' + key + '="' + obj[key] + '"';
  }
  result += '>' + body + '</response>';
  return makeDbgpMessage(result);
}

export function pathToUri(path: string): string {
  return 'file://' + path;
}

export function uriToPath(uri: string): string {
  const components = url.parse(uri);
  // Some filename returned from hhvm does not have protocol.
  if (components.protocol !== 'file:' && components.protocol != null) {
    logger.logErrorAndThrow(`unexpected file protocol. Got: ${components.protocol}`);
  }
  return components.pathname || '';
}

export function getBreakpointLocation(breakpoint: Breakpoint): Object {
  const {filename, lineNumber} = breakpoint.breakpointInfo;
  return {
    // chrome lineNumber is 0-based while xdebug is 1-based.
    lineNumber: lineNumber - 1,
    scriptId: uriToPath(filename),
  };
}

/**
 * Used to start the HHVM instance that the dummy connection connects to so we can evaluate
 * expressions in the REPL.
 */
export function launchScriptForDummyConnection(scriptPath: string): child_process$ChildProcess {
  return launchPhpScriptWithXDebugEnabled(scriptPath);
}

/**
 * Used to start an HHVM instance running the given script in debug mode.
 */
export function launchScriptToDebug(
  scriptPath: string,
  sendToOutputWindow: (text: string) => void,
): Promise<void> {
  return new Promise(resolve => {
    launchPhpScriptWithXDebugEnabled(scriptPath, text => {
      sendToOutputWindow(text);
      resolve();
    });
  });
}

export function launchPhpScriptWithXDebugEnabled(
  scriptPath: string,
  sendToOutputWindowAndResolve?: (text: string) => void,
): child_process$ChildProcess {
  const {phpRuntimePath, phpRuntimeArgs} = getConfig();
  const runtimeArgs = shellParse(phpRuntimeArgs);
  const scriptArgs = shellParse(scriptPath);
  const args = [...runtimeArgs, ...scriptArgs];
  const proc = child_process.spawn(phpRuntimePath, args);
  logger.log(dedent`
    child_process(${proc.pid}) spawned with xdebug enabled.
    $ ${phpRuntimePath} ${args.join(' ')}
  `);

  proc.stdout.on('data', chunk => {
    // stdout should hopefully be set to line-buffering, in which case the
    // string would come on one line.
    const block: string = chunk.toString();
    const output = `child_process(${proc.pid}) stdout: ${block}`;
    logger.log(output);
  });
  proc.on('error', err => {
    logger.log(`child_process(${proc.pid}) error: ${err}`);
    if (sendToOutputWindowAndResolve != null) {
      sendToOutputWindowAndResolve(
        `The process running script: ${scriptPath} encountered an error: ${err}`,
      );
    }
  });
  proc.on('exit', code => {
    logger.log(`child_process(${proc.pid}) exit: ${code}`);
    if (code != null && sendToOutputWindowAndResolve != null) {
      sendToOutputWindowAndResolve(`Script: ${scriptPath} exited with code: ${code}`);
    }
  });
  return proc;
}

export function getMode(): DebuggerMode {
  const {launchScriptPath} = getConfig();
  return launchScriptPath == null ? 'attach' : 'launch';
}
