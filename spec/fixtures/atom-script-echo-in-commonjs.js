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

/* eslint-disable no-console */

import type {ExitCode} from '../../pkg/nuclide-atom-script/lib/types';

async function runCommand(args: Array<string>): Promise<ExitCode> {
  const message = args.length === 0 ? 'Please pass me an arg!' : args.join(' ');
  console.log(message);
  return 0;
}

// This modules is purposefully written in CommonJS to test that atom-script
// can correctly handle modules that export a function, as opposed to a
// `default` function.
module.exports = runCommand;
