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

import {IConnection} from 'vscode-languageserver';
// $FlowFixMe: type layouts
import {layouts} from 'log4js';

function appender(config: {connection: IConnection}) {
  const {connection} = config;

  // eslint-disable-next-line flowtype/no-weak-types
  return (loggingEvent: any): void => {
    connection.console.log(layouts.basicLayout(loggingEvent));
  };
}

// eslint-disable-next-line nuclide-internal/no-commonjs
module.exports.configure = module.exports.appender = appender;
