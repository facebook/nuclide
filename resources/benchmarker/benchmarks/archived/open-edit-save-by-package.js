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

import {timedAsync, timedSync, makeSizedFixture} from '../../benchmarker-utils';

const SAMPLE_FILE = '/tmp/nuclide-benchmarker-open-edit-save.js';
const FILE_SIZE = 10000;
const TIMEOUT = 30 * 1000;

const PACKAGES = [
  '',
  'nuclide-arcanist',
  'language-javascript',
  'language-javascript,nuclide-flow',
  'language-javascript,nuclide-flow,hyperclick',
];
const REPETITIONS = 3;

module.exports = {
  description: 'times how long a 10k file takes to open, edit, save, close with different packages',
  columns: [
    'packages',
    'activate',
    'open',
    'insert0',
    'insert',
    'append',
    'save',
    'close',
  ],
  timeout: TIMEOUT,
  iterations: PACKAGES.length,
  repetitions: REPETITIONS,
  run: async (iteration: number): Object => {
    const result = {};

    // Create a file of the target size.
    makeSizedFixture(SAMPLE_FILE, FILE_SIZE);

    // Activate packages for this iteration.
    const packages = PACKAGES[iteration]
      .split(',')
      .map(p => p.trim())
      .filter(p => p !== '');
    result.packages = packages.join(',');
    const {time: activate} = await timedAsync(
      Promise.all(packages.map(p => atom.packages.activatePackage(p))),
    );
    result.activate = activate;

    // Open the file, insert text, append text, save and close.
    const {ret: editor, time: open} = await timedAsync(
      // eslint-disable-next-line nuclide-internal/atom-apis
      atom.workspace.open(SAMPLE_FILE),
    );
    result.open = open;

    // The first insertion forces buffer tokenization and is much slower than subsequent mutations.
    editor.moveToTop();
    result.insert0 = timedSync(() => editor.insertText('// new line\n')).time;

    editor.moveToTop();
    result.insert = timedSync(() => editor.insertText('// new line\n')).time;

    editor.moveToBottom();
    result.append = timedSync(() => editor.insertText('// new line\n')).time;

    result.save = timedSync(() => editor.save()).time;
    result.close = timedSync(() =>
      atom.workspace.destroyActivePaneItemOrEmptyPane(),
    ).time;

    return result;
  },
};
