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

import {levels} from 'log4js';
import {ProcessLoggingEvent} from 'nuclide-commons/process';
import {shorten} from 'nuclide-commons/string';
import {trackSampled} from 'nuclide-analytics';

const SAMPLE_RATE = 10;

type LoggingEvent = {
  data: Array<mixed>,
  level: Object,
};

export function configure(): (loggingEvent: LoggingEvent) => void {
  return ({data, level}) => {
    if (level === levels.INFO) {
      const arg = data[0];
      if (arg instanceof ProcessLoggingEvent) {
        trackSampled('process-exit', SAMPLE_RATE, {
          command: shorten(arg.command, 100, '...'),
          duration: arg.duration,
        });
      }
    }
  };
}

export const appender = configure;
