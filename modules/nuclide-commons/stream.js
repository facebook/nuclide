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

import Stream from 'stream';
import {Observable} from 'rxjs';

import UniversalDisposable from './UniversalDisposable';
import {attachEvent} from './event';

/**
 * Observe a stream like stdout or stderr.
 */
export function observeStream(stream: stream$Readable): Observable<string> {
  return observeRawStream(stream).map(data => data.toString());
}

export function observeRawStream(stream: stream$Readable): Observable<Buffer> {
  const error = Observable.fromEvent(stream, 'error').flatMap(Observable.throw);
  return Observable.fromEvent(stream, 'data')
    .merge(error)
    .takeUntil(Observable.fromEvent(stream, 'end'));
}

/**
 * Write an observed readable stream into a writeable stream. Effectively a pipe() for observables.
 * Returns an observable accumulating the number of bytes processed.
 */
export function writeToStream(
  source: Observable<Buffer>,
  destStream: stream$Writable,
): Observable<number> {
  return Observable.create(observer => {
    let byteCount = 0;

    const byteCounterStream = new Stream.Transform({
      transform(chunk, encoding, cb) {
        byteCount += chunk.byteLength;
        observer.next(byteCount);
        cb(null, chunk);
      },
    });

    byteCounterStream.pipe(destStream);

    return new UniversalDisposable(
      attachEvent(destStream, 'error', err => {
        observer.error(err);
      }),
      attachEvent(destStream, 'close', () => {
        observer.complete();
      }),
      source.subscribe(
        buffer => {
          byteCounterStream.write(buffer);
        },
        err => {
          observer.error(err);
        },
        () => {
          byteCounterStream.end();
        },
      ),
    );
  }).share();
}
