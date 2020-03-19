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
import {IConnection} from 'vscode-languageserver';
import {
  type LogMessageParams,
  MessageType,
} from '../nuclide-vscode-language-service-rpc/lib/protocol';

function getMessageType(levelStr: string) {
  switch (levelStr) {
    case 'ERROR':
      return MessageType.Error;
    case 'WARN':
      return MessageType.Warning;
    case 'INFO':
      return MessageType.Info;
    default:
      return MessageType.Log;
  }
}

function appender(config: {connection: IConnection}) {
  const {connection} = config;

  // eslint-disable-next-line flowtype/no-weak-types
  return (loggingEvent: any): void => {
    // $FlowFixMe: type log4js.layouts
    const message = log4js.layouts.basicLayout(loggingEvent);
    if (loggingEvent.level.level >= log4js.levels.WARN.level) {
      connection.console.log(message);
    }
    connection.telemetry.logEvent(
      ({
        type: getMessageType(loggingEvent.level.levelStr),
        message,
      }: LogMessageParams),
    );
  };
}

// eslint-disable-next-line nuclide-internal/no-commonjs
module.exports.configure = module.exports.appender = appender;
