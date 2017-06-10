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

import fs from 'fs';
import temp from 'temp';
import {Observable} from 'rxjs';
import {attachEvent} from 'nuclide-commons/event';
import fsPromise from 'nuclide-commons/fsPromise';
import {observeStream} from 'nuclide-commons/stream';
import {splitStream} from 'nuclide-commons/observable';

// Returns the number of replacements made.
export default function replaceInFile(
  path: string,
  regex: RegExp,
  replacement: string,
): Observable<number> {
  return Observable.defer(() => {
    const readStream = fs.createReadStream(path);
    // Write the replaced output to a temporary file.
    // We'll overwrite the original when we're done.
    const tempStream: fs.WriteStream = temp.createWriteStream();

    // $FlowIssue: fs.WriteStream contains a path.
    const tempPath = tempStream.path;

    return Observable.concat(
      // Replace the output line-by-line. This obviously doesn't work for multi-line regexes,
      // but this mimics the behavior of Atom's `scandal` find-and-replace backend.
      splitStream(observeStream(readStream))
        .map(line => {
          const matches = line.match(regex);
          if (matches != null) {
            tempStream.write(line.replace(regex, replacement));
            return matches.length;
          }
          tempStream.write(line);
          return 0;
        })
        .reduce((acc, curr) => acc + curr, 0),
      // Wait for the temporary file to finish.
      // We need to ensure that the event handler is attached before end().
      Observable.create(observer => {
        const disposable = attachEvent(tempStream, 'finish', () => {
          observer.complete();
        });
        tempStream.end();
        return () => disposable.dispose();
      }),
      // Copy the permissions from the orignal file.
      Observable.defer(() => copyPermissions(path, tempPath)).ignoreElements(),
      // Overwrite the original file with the temporary file.
      Observable.defer(() => fsPromise.rename(tempPath, path)).ignoreElements(),
    ).catch(err => {
      // Make sure we clean up the temporary file if an error occurs.
      fsPromise.unlink(tempPath).catch(() => {});
      return Observable.throw(err);
    });
  });
}

async function copyPermissions(from: string, to: string): Promise<void> {
  const {mode} = await fsPromise.stat(from);
  await fsPromise.chmod(to, mode);
}
