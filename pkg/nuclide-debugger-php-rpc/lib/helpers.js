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

import type {Breakpoint} from './BreakpointStore';
import type {DebuggerMode} from './types';

import dedent from 'dedent';
import child_process from 'child_process';
import logger from './utils';
import {getConfig} from './config';
import {shellParse} from 'nuclide-commons/string';
import {runCommand} from 'nuclide-commons/process';
import nuclideUri from 'nuclide-commons/nuclideUri';

import {pathToUri, uriToPath} from '../../nuclide-debugger-common/lib/helpers';
export {pathToUri, uriToPath};

export const DUMMY_FRAME_ID = 'Frame.0';

export function isContinuationCommand(command: string): boolean {
  return ['run', 'step_into', 'step_over', 'step_out', 'stop', 'detach'].some(
    continuationCommand => continuationCommand === command,
  );
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
  const processes = await runCommand('ps', ['aux'], {}).toPromise();
  return processes.toString().split('\n').slice(1).some(line => {
    return (
      line.indexOf('m debug') >= 0 || line.indexOf('mode debug') >= 0 // hhvm -m debug
    ); // hhvm --mode debug
  });
}

export function makeDbgpMessage(message: string): string {
  return String(message.length) + '\x00' + message + '\x00';
}

export function makeMessage(obj: Object, body_: ?string): string {
  let body = body_;
  body = body || '';
  let result =
    '<?xml version="1.0" encoding="iso-8859-1"?>' +
    '<response xmlns="urn:debugger_protocol_v1" xmlns:xdebug="http://xdebug.org/dbgp/xdebug"';
  for (const key in obj) {
    result += ' ' + key + '="' + obj[key] + '"';
  }
  result += '>' + body + '</response>';
  return makeDbgpMessage(result);
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
export function launchScriptForDummyConnection(
  scriptPath: string,
): child_process$ChildProcess {
  return launchPhpScriptWithXDebugEnabled(scriptPath);
}

/**
 * Used to start an HHVM instance running the given script in debug mode.
 */
export function launchScriptToDebug(
  scriptPath: string,
  sendToOutputWindow: (text: string, level: string) => void,
): Promise<void> {
  return new Promise(resolve => {
    launchPhpScriptWithXDebugEnabled(scriptPath, (text, level) => {
      sendToOutputWindow(text, level);
      resolve();
    });
  });
}

export function launchPhpScriptWithXDebugEnabled(
  scriptPath: string,
  sendToOutputWindowAndResolve?: (text: string, level: string) => void,
): child_process$ChildProcess {
  const {
    phpRuntimePath,
    phpRuntimeArgs,
    dummyRequestFilePath,
    launchWrapperCommand,
  } = getConfig();
  const runtimeArgs = shellParse(phpRuntimeArgs);
  const isDummyLaunch = scriptPath === dummyRequestFilePath;

  let processPath = phpRuntimePath;
  const processOptions = {};
  if (!isDummyLaunch && launchWrapperCommand != null) {
    processPath = launchWrapperCommand;
    processOptions.cwd = nuclideUri.dirname(dummyRequestFilePath);
  }

  const scriptArgs = shellParse(scriptPath);
  const args = [...runtimeArgs, ...scriptArgs];
  const proc = child_process.spawn(processPath, args, processOptions);
  logger.debug(
    dedent`
    child_process(${proc.pid}) spawned with xdebug enabled.
    $ ${phpRuntimePath} ${args.join(' ')}
  `,
  );

  proc.stdout.on('data', chunk => {
    // stdout should hopefully be set to line-buffering, in which case the
    // string would come on one line.
    const block: string = chunk.toString();
    const output = `child_process(${proc.pid}) stdout: ${block}`;
    logger.debug(output);
    // No need to forward stdout to the client here. Stdout is also sent
    // over the XDebug protocol channel and is forwarded to the client
    // by DbgpSocket.
  });
  proc.stderr.on('data', chunk => {
    const block: string = chunk.toString().trim();
    const output = `child_process(${proc.pid}) stderr: ${block}`;
    logger.debug(output);
    // TODO: Remove this when XDebug forwards stderr streams over
    // DbgpSocket.
    if (sendToOutputWindowAndResolve != null) {
      sendToOutputWindowAndResolve(block, 'error');
    }
  });
  proc.on('error', err => {
    logger.debug(`child_process(${proc.pid}) error: ${err}`);
    if (sendToOutputWindowAndResolve != null) {
      sendToOutputWindowAndResolve(
        `The process running script: ${scriptPath} encountered an error: ${err}`,
        'error',
      );
    }
  });
  proc.on('exit', code => {
    logger.debug(`child_process(${proc.pid}) exit: ${code}`);
    if (code != null && sendToOutputWindowAndResolve != null) {
      sendToOutputWindowAndResolve(
        `Script: ${scriptPath} exited with code: ${code}`,
        code === 0 ? 'info' : 'error',
      );
    }
  });
  return proc;
}

export function getMode(): DebuggerMode {
  const {launchScriptPath} = getConfig();
  return launchScriptPath == null ? 'attach' : 'launch';
}
