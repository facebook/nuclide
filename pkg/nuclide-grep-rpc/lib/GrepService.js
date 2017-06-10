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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import {ConnectableObservable, Observable} from 'rxjs';

import nuclideUri from 'nuclide-commons/nuclideUri';
import replaceInFile from './replaceInFile';
import search from './scanhandler';

export type search$Match = {
  lineText: string,
  lineTextOffset: number,
  matchText: string,
  range: Array<Array<number>>,
};

export type search$FileResult = {
  filePath: NuclideUri,
  matches: Array<search$Match>,
};

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

export function grepSearch(
  directory: NuclideUri,
  regex: RegExp,
  subdirs: Array<string>,
): ConnectableObservable<search$FileResult> {
  return search(directory, regex, subdirs)
    .map(update => {
      // Transform filePath's to absolute paths.
      return {
        filePath: nuclideUri.join(directory, update.filePath),
        matches: update.matches,
      };
    })
    .publish();
}

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
