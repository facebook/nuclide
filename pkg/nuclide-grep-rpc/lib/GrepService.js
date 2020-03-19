/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import replaceInFile from './replaceInFile';
import {ConnectableObservable, Observable} from 'rxjs';

export type search$ReplaceResult =
  | {
      type: 'success',
      filePath: NuclideUri,
      replacements: number,
    }
  | {
      type: 'error',
      filePath: NuclideUri,
      message: string,
    };

export function grepReplace(
  filePaths: Array<NuclideUri>,
  regex: RegExp,
  replacementText: string,
  concurrency: number = 4,
): ConnectableObservable<search$ReplaceResult> {
  return Observable.from(filePaths)
    .mergeMap(
      filePath =>
        replaceInFile(filePath, regex, replacementText)
          .map(replacements => ({
            type: 'success',
            filePath,
            replacements,
          }))
          .catch(err => {
            return Observable.of({
              type: 'error',
              filePath,
              message: err.message,
            });
          }),
      concurrency,
    )
    .publish();
}
