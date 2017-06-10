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
import type {AslLevel, AslRecord} from './types';

import {parseMessageText} from './parseMessageText';

/**
 * Convert a structured logcat entry into the format that nuclide-console wants.
 */
export function createMessage(record: AslRecord): Message {
  const {text, level, tags} = parseMessageText(record.Message);
  return {
    text,
    level: level == null ? getLevel(record.Level) : level,
    tags: tags == null ? undefined : tags,
  };
}

function getLevel(level: AslLevel): Level {
  switch (level) {
    case '0': // Emergency
    case '1': // Alert
    case '2': // Critical
    case '3': // Error
      return 'error';
    case '4': // Warning
      return 'warning';
    case '5': // Notice
      return 'log';
    case '6': // Info
      return 'info';
    case '7': // Debug
      return 'debug';
    default:
      throw new Error(`Invalid ASL level: ${level}`);
  }
}
