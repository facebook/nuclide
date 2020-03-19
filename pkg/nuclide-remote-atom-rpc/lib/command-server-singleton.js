/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import {CommandServer} from './CommandServer';

const commandServerInstance = new CommandServer();

/** @return singleton instance of CommandServer. */
export function getCommandServer(): CommandServer {
  return commandServerInstance;
}
