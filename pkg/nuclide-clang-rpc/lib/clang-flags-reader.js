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

import type {ClangCompilationDatabaseEntry} from './rpc-types';

import fs from 'fs';
import fsPromise from 'nuclide-commons/fsPromise';
import {Observable} from 'rxjs';
import {observeStream} from 'nuclide-commons/stream';

// Remark: this approach will fail if a { or }
// appears in a string (e.g. in a filename), fall back to JSON.parse otherwise.
export function readCompilationFlags(
  flagsFile: string,
): Observable<ClangCompilationDatabaseEntry> {
  // For some real-world numbers:
  // 1. 217 MB compilation db with 330 entries,
  //    - full read: 1400ms
  //    - chunked read: 1800ms
  // 2. 434 MB compilation db with 660 entries,
  //    -  full read: "Error: toString() failed"
  //    -  chunked read: 4500ms
  return Observable.create(subscriber => {
    let chunk: string = '';
    function emitChunk() {
      try {
        subscriber.next(JSON.parse(chunk));
      } catch (e) {
        subscriber.error(e);
      }
      chunk = '';
    }
    function handleChunk(data: string) {
      if (chunk.length === 0) {
        // If the chunk is empty we look for the opening brace.
        const start = data.indexOf('{');
        if (start !== -1) {
          chunk = '{';
          return handleChunk(data.slice(start + 1));
        }
      } else {
        // We are currently in a chunk so look for the end.
        const end = data.indexOf('}');
        if (end !== -1) {
          chunk += data.slice(0, end + 1);
          emitChunk();
          handleChunk(data.slice(end + 1));
        } else {
          chunk += data;
        }
      }
    }
    return observeStream(fs.createReadStream(flagsFile)).subscribe(
      handleChunk,
      subscriber.error.bind(subscriber),
      subscriber.complete.bind(subscriber),
    );
  });
}

export async function fallbackReadCompilationFlags(
  flagsFile: string,
): Promise<Array<ClangCompilationDatabaseEntry>> {
  const contents = await fsPromise.readFile(flagsFile);
  return JSON.parse(contents.toString());
}
