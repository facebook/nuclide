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

import {runCommand} from 'nuclide-commons/process';

export const HACK_LOGGER_CATEGORY = 'nuclide-hack';

const PATH_TO_HH_CLIENT = 'hh_client';

// Kick this off early, so we don't need to repeat this on every call.
// We don't have a way of changing the path on the dev server after a
// connection is made so this shouldn't change over time.
// Worst case scenario is requiring restarting Nuclide after changing the hh_client path.
export const DEFAULT_HACK_COMMAND: Promise<string> = findHackCommand();

// Returns the empty string on failure
async function findHackCommand(): Promise<string> {
  try {
    return (await runCommand('which', [PATH_TO_HH_CLIENT]).toPromise()).trim();
  } catch (err) {
    return '';
  }
}
