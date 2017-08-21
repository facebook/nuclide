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

import type {formatResult} from './ReasonService';

import {runCommand, getOriginalEnvironment} from 'nuclide-commons/process';
import nuclideUri from 'nuclide-commons/nuclideUri';

export async function formatImpl(
  content: string,
  filePath: string,
  language: 're' | 'ml',
  refmtFlags: Array<string>,
): Promise<formatResult> {
  // refmt is designed for reason->reason and ocaml->reason formatting
  // ocp-indent is designed for ocaml->ocaml formatting
  const path = language === 're' ? getPathToRefmt() : 'ocp-indent';
  const flags = language === 're' ? refmtFlags : [];
  const options = {
    // Starts the process with the user's bashrc, which might contain a
    // different refmt. See `MerlinProcess` for the same consistent
    // logic. This also implies .nucliderc isn't considered, if there's any
    // extra override; to simulate the same behavior, do this in your bashrc:
    // if [ "$TERM" = "nuclide"]; then someOverrideLogic if
    env: await getOriginalEnvironment(),
    input: content,
    cwd: nuclideUri.dirname(filePath),
  };
  try {
    const stdout = await runCommand(path, flags, options).toPromise();
    return {type: 'result', formattedResult: stdout};
  } catch (err) {
    // Unsuccessfully exited. Two cases: syntax error and refmt nonexistent.
    if (err.errno === 'ENOENT') {
      return {
        type: 'error',
        error: `${path} is not found. Is it available in the path?`,
      };
    }
    return {type: 'error', error: err.stderr};
  }
}
/**
 * @return The path to ocamlmerlin on the user's machine. It is recommended not to cache the result
 *   of this function in case the user updates his or her preferences in Atom, in which case the
 *   return value will be stale.
 */
function getPathToRefmt(): string {
  return (
    (global.atom &&
      global.atom.config.get('nuclide.nuclide-ocaml.pathToRefmt')) ||
    'refmt'
  );
}
