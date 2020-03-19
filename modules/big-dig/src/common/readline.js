/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict
 * @format
 */

import readline from 'readline';
import Stream from 'stream';

export function question(query: string, hideInput: boolean): Promise<string> {
  // http://stackoverflow.com/questions/24037545/how-to-hide-password-in-the-nodejs-console
  let output;
  let muted = false;

  if (hideInput) {
    output = new Stream.Writable({
      write(chunk, encoding, callback) {
        if (!muted) {
          process.stdout.write(chunk, encoding);
        }
        callback();
      },
    });
  } else {
    output = process.stdout;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output,
    terminal: true,
  });
  return new Promise(resolve => {
    rl.question(query, answer => {
      rl.close();
      resolve(answer);
    });
    muted = true;
  });
}
