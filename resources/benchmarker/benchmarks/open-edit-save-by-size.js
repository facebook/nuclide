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

import {timedAsync, timedSync, makeSizedFixture} from '../benchmarker-utils';

const SAMPLE_FILE = '/tmp/nuclide-benchmarker-open-edit-save.js';
const TIMEOUT = 30 * 1000;

const ITERATIONS = 32; // From 0 bytes to 10^6 bytes exponentially, as per sizeForIteration.
const REPETITIONS = 3;

function sizeForIteration(iteration: number): number {
  if (iteration > 0) {
    return Math.round(Math.pow(10, (iteration - 1) * 0.2));
  }
  return 0;
}

// eslint-disable-next-line nuclide-internal/no-commonjs
module.exports = {
  description:
    'times how long different sized files take to open, edit, save, close',
  columns: ['bytes', 'open', 'insert0', 'insert', 'append', 'save', 'close'],
  timeout: TIMEOUT,
  iterations: ITERATIONS,
  repetitions: REPETITIONS,
  getIterationDescription: (iteration: number): string => {
    return `Open, edit, save, close a ${sizeForIteration(iteration)} byte file`;
  },
  run: async (iteration: number): Object => {
    const result = {};

    // Create a file of the target size.
    result.bytes = sizeForIteration(iteration);
    makeSizedFixture(SAMPLE_FILE, result.bytes);

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
    result.close = timedSync(() => atom.workspace.destroyActivePaneItem()).time;

    return result;
  },
};
