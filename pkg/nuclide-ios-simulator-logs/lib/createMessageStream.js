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

import {bufferUntil} from 'nuclide-commons/observable';
import featureConfig from 'nuclide-commons-atom/feature-config';
import {createMessage} from './createMessage';
import plist from 'plist';
import {Observable} from 'rxjs';

export function createMessageStream(
  line$: Observable<string>,
): Observable<Message> {
  // Group the lines into valid plist strings.
  const messages = bufferUntil(line$, line => line.trim() === '</plist>')
    // Don't include empty buffers. This happens if the stream completes since we opened a new
    // buffer when the previous record ended.
    .filter(lines => lines.length > 1)
    .map(lines => lines.join(''))
    // Parse the plists. Each parsed plist contains an array which, in turn, *may* contain dicts
    // (that correspond to records). We just want those dicts so we use `flatMap()`.
    .flatMap(xml => plist.parse(xml))
    // Exclude dicts that don't have any message property.
    .filter(record => record.hasOwnProperty('Message'))
    // Exclude blacklisted senders.
    // FIXME: This is a stopgap. What we really need to do is identify the currently running app and
    //   only show its messages. ):
    .filter(record => {
      const blacklist = ((featureConfig.get(
        'nuclide-ios-simulator-logs.senderBlacklist',
      ): any): Array<string>);
      return blacklist.indexOf(record.Sender) === -1;
    })
    // Format the messages for Nuclide.
    .map(createMessage);

  return filter(messages);
}

function filter(messages: Observable<Message>): Observable<Message> {
  const patterns = featureConfig
    .observeAsStream('nuclide-ios-simulator-logs.whitelistedTags')
    .map((source: any) => {
      try {
        return new RegExp(source);
      } catch (err) {
        atom.notifications.addError(
          'The nuclide-ios-simulator-logs.whitelistedTags setting contains an invalid regular' +
            ' expression string. Fix it in your Atom settings.',
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
