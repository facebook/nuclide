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

import {createLogger} from 'redux-logger';
import featureConfig from './feature-config';

/*
To turn on debug console logging for the feature you are debugging, add to your config.cson:

"*":
  "nuclide":
    "redux-debug-loggers": [
      "<YOUR_APP_NAME>"
    ]
*/

type Store = {
  getState: () => mixed,
};

type Action = {
  type: string,
};

type Dispatch = Action => Action;

// More options can be found here if you wish to enable them:
// https://github.com/evgenyrodionov/redux-logger#options
type LoggerConfig = {
  diff: boolean,
};

const enabledLoggers = featureConfig.getWithDefaults('redux-debug-loggers', []);

const noopMiddleware = (store: Store) => (next: Dispatch) => (action: Action) =>
  next(action);

export default function createLoggerMiddleware(
  appName: string,
  loggerConfig: ?LoggerConfig,
) {
  if (!enabledLoggers.includes(appName)) {
    return noopMiddleware;
  }

  return createLogger(loggerConfig);
}
