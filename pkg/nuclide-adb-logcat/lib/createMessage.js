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

import type {Level, Message} from '../../nuclide-console/lib/types';
import type {LogcatEntry, Priority} from './types';

/**
 * Convert a structured logcat entry into the format that nuclide-console wants.
 */
export default function createMessage(entry: LogcatEntry): Message {
  const priority = (entry.metadata && entry.metadata.priority) || 'I';
  const tag = (entry.metadata && entry.metadata.tag) || null;
  return {
    text: entry.message,
    level: priorityToLevel(priority),
    tags: tag ? [tag] : null,
  };
}

function priorityToLevel(priority: Priority): Level {
  switch (priority) {
    case 'W': // warn
      return 'warning';
    case 'E': // error
    case 'F': // fatal
      return 'error';
    case 'S': // silent
      throw new Error('Silent messages should be filtered');
    case 'D': // debug
      return 'debug';
    case 'I': // info
      // Even though the console has an "info" level, this is the default for adb, so we use "log."
      return 'log';
    case 'V': // verbose
    default:
      return 'info';
  }
}
