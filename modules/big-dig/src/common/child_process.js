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

import child_process from 'child_process';

export function execFile(
  file: string,
  args: Array<string>,
  options: Object,
): Promise<void> {
  return new Promise((resolve, reject) => {
    child_process.execFile(
      file,
      args,
      options,
      (error: ?Error, stdout: string | Buffer, stderr: string | Buffer) => {
        if (error != null) {
          reject(error);
          return;
        }

        resolve();
      },
    );
  });
}
