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

import chalk from 'chalk';

import type {ExitCode} from '../lib/types';

export default (async function runCommand(): Promise<ExitCode> {
  const ctx = new chalk.constructor({enabled: true});
  const out = Object.keys(process.versions)
    .map(key => [key, process.versions[key]])
    .concat([['atom', atom.getVersion()]])
    .map(([name, version]) => `${ctx.yellow(name)}=${ctx.green(version)}`)
    .sort()
    .join('\n');
  console.log(out);
  return 0;
});
