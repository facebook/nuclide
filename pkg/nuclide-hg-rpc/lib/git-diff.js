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

import fsPromise from 'nuclide-commons/fsPromise';
import {Observable} from 'rxjs';
import {runCommandDetailed} from 'nuclide-commons/process';

export function gitDiffStrings(
  oldString: string,
  newString: string,
): Observable<string> {
  return makeTempFiles(oldString, newString).switchMap(
    ([oldTempFile, newTempFile]) =>
      runCommandDetailed(
        'git',
        ['diff', '--unified=0', '--no-index', oldTempFile, newTempFile],
        {
          killTreeWhenDone: true,
        },
      )
        .map(({stdout}) => stdout)
        .catch(e => {
          // git diff returns with exit code 1 if there was a difference between
          // the files being compared
          return Observable.of(e.stdout);
        })
        .finally(() => {
          fsPromise.unlink(oldTempFile);
          fsPromise.unlink(newTempFile);
        }),
  );
}

function makeTempFiles(
  oldString: string,
  newString: string,
): Observable<[string, string]> {
  let oldFilePath: string;
  let newFilePath: string;
  return Observable.forkJoin(
    Observable.fromPromise(fsPromise.tempfile())
      .map(filePath => {
        oldFilePath = filePath.trim();
        return oldFilePath;
      })
      .switchMap(filePath => {
        return writeContentsToFile(oldString, filePath).map(() => filePath);
      }),
    Observable.fromPromise(fsPromise.tempfile())
      .map(filePath => {
        newFilePath = filePath.trim();
        return newFilePath;
      })
      .switchMap(filePath => {
        return writeContentsToFile(newString, filePath).map(() => filePath);
      }),
  ).catch(error => {
    if (oldFilePath != null) {
      fsPromise.unlink(oldFilePath);
    }
    if (newFilePath != null) {
      fsPromise.unlink(newFilePath);
    }
    return Observable.throw(error);
  });
}

function writeContentsToFile(
  contents: string,
  filePath: string,
): Observable<void> {
  return Observable.fromPromise(fsPromise.writeFile(filePath, contents));
}
