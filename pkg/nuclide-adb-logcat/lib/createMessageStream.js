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

import type {Message} from '../../nuclide-console/lib/types';

import featureConfig from 'nuclide-commons-atom/feature-config';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import createMessage from './createMessage';
import parseLogcatMetadata from './parseLogcatMetadata';
import {Observable} from 'rxjs';

export default function createMessageStream(
  line$: Observable<string>,
): Observable<Message> {
  // Separate the lines into groups, beginning with metadata lines.
  const messages = Observable.create(observer => {
    let buffer = [];
    let prevMetadata = null;
    const prevLineIsBlank = () => buffer[buffer.length - 1] === '';

    const flush = () => {
      if (buffer.length === 0) {
        return;
      }

      // Remove the empty line, which is a message separator.
      if (prevLineIsBlank()) {
        buffer.pop();
      }

      observer.next({
        metadata: prevMetadata,
        message: buffer.join('\n'),
      });
      buffer = [];
      prevMetadata = null;
    };

    const sharedLine$ = line$.share();

    return new UniversalDisposable(
      // Buffer incoming lines.
      sharedLine$.subscribe(
        // onNext
        line => {
          let metadata;
          const hasPreviousLines = buffer.length > 0;

          if (!hasPreviousLines || prevLineIsBlank()) {
            metadata = parseLogcatMetadata(line);
          }

          if (metadata) {
            // We've reached a new message so the other one must be done.
            flush();
            prevMetadata = metadata;
          } else {
            buffer.push(line);
          }
        },
        // onError
        error => {
          flush();
          observer.error(error);
        },
        // onCompleted
        () => {
          flush();
          observer.complete();
        },
      ),
      // We know *for certain* that we have a complete entry once we see the metadata for the next
      // one. But what if the next one takes a long time to happen? After a certain point, we need
      // to just assume we have the complete entry and move on.
      sharedLine$.debounceTime(200).subscribe(flush),
    );
  }).map(createMessage);

  return filter(messages).share();
}

function filter(messages: Observable<Message>): Observable<Message> {
  const patterns = (featureConfig.observeAsStream(
    'nuclide-adb-logcat.whitelistedTags',
  ): Observable<any>).map(source => {
    try {
      return new RegExp(source);
    } catch (err) {
      atom.notifications.addError(
        'The nuclide-adb-logcat.whitelistedTags setting contains an invalid regular expression' +
          ' string. Fix it in your Atom settings.',
      );
      return /.*/;
    }
  });

  return messages
    .withLatestFrom(patterns)
    .filter(([message, pattern]) => {
      // Add an empty tag to untagged messages so they cfeaturean be matched by `.*` etc.
      const tags = message.tags == null ? [''] : message.tags;
      return tags.some(tag => pattern.test(tag));
    })
    .map(([message, pattern]) => message);
}
