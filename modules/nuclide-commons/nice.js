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

import type {LRUCache} from 'lru-cache';
import type {ObserveProcessOptions, ProcessMessage} from './process';

import LRU from 'lru-cache';
import {Observable} from 'rxjs';

import which from './which';
import {spawn, observeProcess} from './process';

const NICE_COMMAND = 'nice';
const IONICE_COMMAND = 'ionice';

export async function niceSafeSpawn(
  command: string,
  args: Array<string>,
  execOptions?: Object,
): Promise<child_process$ChildProcess> {
  const nicified = await nicifyCommand(command, args, execOptions);
  const processStream = spawn(...nicified).publish();
  const processPromise = processStream.take(1).toPromise();
  processStream.connect();
  return processPromise;
}

/**
* Takes the arguments that you would normally pass to `spawn()` and returns an array of new
* arguments to use to run the command under `nice`.
 *
 * Example:
 *
 * ```js
 * observeProcess(...(await nicifyCommand('hg', ['diff']))).subscribe(...);
 * ```
 *
 * See also `scriptifyCommand()` which does a similar thing but for `script`.
 */
async function nicifyCommand<T>(
  command: string,
  args?: Array<string>,
  options: T,
): Promise<[string, Array<string>, T]> {
  const fullArgs = [command, ...(args || [])];
  if (await hasNiceCommand()) {
    fullArgs.unshift(NICE_COMMAND);
  }
  if (await hasIoniceCommand()) {
    // Leave the process in the Best Effort class (default), but set it to the lowest priority for
    // that class. Priorities range from 0-7 with 4 as the default and lower numbers representing
    // higher priorities.
    //
    // See `man ionice` or http://linux.die.net/man/1/ionice
    //
    // It's not specified by POSIX like `nice` is but since it is included in util-linux which is
    // relatively core
    // (https://git.kernel.org/cgit/utils/util-linux/util-linux.git/tree/schedutils/ionice.c), I
    // think we can assume that it uses this interface if it exists.
    fullArgs.unshift(IONICE_COMMAND, '-n', '7');
  }
  return [fullArgs[0], fullArgs.slice(1), options];
}

const commandAvailabilityCache: LRUCache<string, boolean> = LRU({
  max: 10,
  // Realistically this will not change very often so we can cache for long periods of time. We
  // probably could just check at startup and get away with it, but maybe someone will install
  // `ionice` and it would be nice to pick that up.
  maxAge: 1000 * 60 * 5, // 5 minutes
});

function hasNiceCommand(): Promise<boolean> {
  return hasCommand(NICE_COMMAND);
}

function hasIoniceCommand(): Promise<boolean> {
  return hasCommand(IONICE_COMMAND);
}

async function hasCommand(command: string): Promise<boolean> {
  let result: ?boolean = commandAvailabilityCache.get(command);
  if (result == null) {
    result = (await which(command)) != null;
    commandAvailabilityCache.set(command, result);
  }
  return result;
}

export function niceObserveProcess(
  command: string,
  args?: Array<string>,
  options?: ObserveProcessOptions,
): Observable<ProcessMessage> {
  return Observable.defer(() =>
    nicifyCommand(command, args, options),
  ).switchMap(spawnArgs => observeProcess(...spawnArgs));
}
