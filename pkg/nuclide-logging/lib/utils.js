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

import log4js from 'log4js';

import type {LoggingEvent} from './types';

/**
 * JSON.stringify can't stringify instance of Error. To solve this problem, we
 * patch the errors in loggingEvent.data and convert it to an Object with 'name', 'message',
 * 'stack' and 'stackTrace' as fields.
 * If there is no error attached to loggingEvent.data, we create a new error and append it to
 * loggingEvent.data, so that we could get stack information which helps categorization in
 * logview.
 */
export function patchErrorsOfLoggingEvent(
  loggingEvent: LoggingEvent,
): LoggingEvent {
  const loggingEventCopy = {...loggingEvent};
  loggingEventCopy.data = (loggingEventCopy.data || []).slice();

  if (!loggingEventCopy.data.some(item => item instanceof Error)) {
    loggingEventCopy.data.push(new Error('Auto generated Error'));
  }

  loggingEventCopy.data = loggingEventCopy.data.map(item => {
    if (item instanceof Error) {
      return {
        name: item.name,
        message: item.message,
        stack: item.stack,
        stackTrace: item.stackTrace,
      };
    }
    return item;
  });

  return loggingEventCopy;
}

/**
 * Takes a loggingEvent object, returns string representation of it.
 */
export function serializeLoggingEvent(loggingEvent: mixed): string {
  return JSON.stringify(loggingEvent);
}

/**
 * Takes a string, returns an object with the correct log properties.
 *
 * This method has been "borrowed" from the `multiprocess` appender
 * by `nomiddlename` (https://github.com/nomiddlename/log4js-node/blob/master/lib/appenders/multiprocess.js)
 *
 * Apparently, node.js serializes everything to strings when using `process.send()`,
 * so we need smart deserialization that will recreate log date and level for further processing by
 * log4js internals.
 */
export function deserializeLoggingEvent(
  loggingEventString: string,
): LoggingEvent {
  let loggingEvent;
  try {
    loggingEvent = JSON.parse(loggingEventString);
    loggingEvent.startTime = new Date(loggingEvent.startTime);
    loggingEvent.level = log4js.levels.toLevel(loggingEvent.level.levelStr);
  } catch (e) {
    // JSON.parse failed, just log the contents probably a naughty.
    loggingEvent = {
      startTime: new Date(),
      categoryName: 'log4js',
      level: log4js.levels.ERROR,
      data: ['Unable to parse log:', loggingEventString],
    };
  }
  return loggingEvent;
}
