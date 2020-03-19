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

import {getLogger} from 'log4js';
import {combineEpics} from './redux-observable';

export function combineEpicsFromImports(
  epics: Object,
  module: ?string,
): Function {
  return combineEpics(
    ...Object.values(epics)
      .filter(epic => typeof epic === 'function')
      // Catch each epic individually, instead of catching the rootEpic
      // since otherwise we'll resubscribe every epic on any error.
      // https://github.com/redux-observable/redux-observable/issues/94
      .map(epic => (...args) =>
        // $FlowFixMe(>=0.70.0) Flow suppress
        epic(...args).catch((error, source) => {
          if (module != null) {
            getLogger(module).error(error);
          }
          return source;
        }),
      ),
  );
}
