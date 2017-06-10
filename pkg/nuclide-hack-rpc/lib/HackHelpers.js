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

import type {HackRange} from './rpc-types';
import type {HackSpan} from './OutlineView';

import invariant from 'assert';
import {runCommandDetailed} from 'nuclide-commons/process';
import {PromiseQueue} from '../../commons-node/promise-executors';
import {getHackExecOptions} from './hack-config';
import {Point, Range} from 'simple-text-buffer';
import {trackTiming} from '../../nuclide-analytics';

const HH_SERVER_INIT_MESSAGE = 'hh_server still initializing';
const HH_SERVER_BUSY_MESSAGE = 'hh_server is busy';
import {logger} from './hack-config';

let hhPromiseQueue: ?PromiseQueue = null;

/**
  * Executes hh_client with proper arguments returning the result string or json object.
  */
export async function callHHClient(
  args: Array<any>,
  errorStream: boolean,
  processInput: ?string,
  filePath: string,
): Promise<?(string | Object)> {
  if (!hhPromiseQueue) {
    hhPromiseQueue = new PromiseQueue();
  }

  const hackExecOptions = await getHackExecOptions(filePath);
  if (!hackExecOptions) {
    return null;
  }
  const {hackRoot, hackCommand} = hackExecOptions;

  return trackTiming(trackingIdOfHackArgs(args) + ':plus-queue', () => {
    invariant(hhPromiseQueue);
    return hhPromiseQueue.submit(async () => {
      // Append args on the end of our commands.
      const defaults = [
        '--json',
        '--retries',
        '0',
        '--retry-if-init',
        'false',
        '--from',
        'nuclide',
      ];

      const allArgs = defaults.concat(args);
      allArgs.push(hackRoot);

      let execResult = null;

      logger.debug(`Calling Hack: ${hackCommand} with ${allArgs.toString()}`);
      execResult = await trackTiming(trackingIdOfHackArgs(args), () => {
        // TODO: Can't we do a better job with error handling here?
        try {
          return runCommandDetailed(hackCommand, allArgs, {
            input: processInput,
            isExitError: () => false,
          }).toPromise();
        } catch (err) {
          return {stdout: '', stderr: ''};
        }
      });

      const {stdout, stderr} = execResult;
      if (stderr.indexOf(HH_SERVER_INIT_MESSAGE) !== -1) {
        throw new Error(
          `${HH_SERVER_INIT_MESSAGE}: try: \`arc build\` or try again later!`,
        );
      } else if (stderr.startsWith(HH_SERVER_BUSY_MESSAGE)) {
        throw new Error(
          `${HH_SERVER_BUSY_MESSAGE}: try: \`arc build\` or try again later!`,
        );
      }

      const output = errorStream ? stderr : stdout;
      // keeping this at "Trace" log level, since output for --color contains
      // entire file contents, which fills the logs too quickly
      logger.trace(`Hack output for ${allArgs.toString()}: ${output}`);
      try {
        const result = JSON.parse(output);
        invariant(result.hackRoot === undefined);
        // result may be an array, so don't return a new object.
        result.hackRoot = hackRoot;
        return result;
      } catch (err) {
        const errorMessage = `hh_client error, args: [${args.join(',')}]
stdout: ${stdout}, stderr: ${stderr}`;
        logger.error(errorMessage);
        throw new Error(errorMessage);
      }
    });
  });
}

export function hackRangeToAtomRange(position: HackRange): atom$Range {
  return new Range(
    atomPointOfHackRangeStart(position),
    // Atom ranges exclude the endpoint.
    atomPointFromHack(position.line, position.char_end + 1),
  );
}

export function hackSpanToAtomRange(span: HackSpan): atom$Range {
  return new Range(
    atomPointFromHack(span.line_start, span.char_start),
    // Atom ranges exclude the endpoint.
    atomPointFromHack(span.line_end, span.char_end + 1),
  );
}

export function atomPointOfHackRangeStart(position: HackRange): atom$Point {
  return atomPointFromHack(position.line, position.char_start);
}

export function atomPointFromHack(
  hackLine: number,
  hackColumn: number,
): atom$Point {
  return new Point(hackLine - 1, hackColumn - 1);
}

function trackingIdOfHackArgs(args: Array<string>): string {
  const command = args.length === 0 ? '--diagnostics' : args[0];
  invariant(command.startsWith('--'));
  return 'hh_client:' + command.substr(2);
}
