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

import type {AtomCommands, ConnectionDetails} from './rpc-types';

import {CommandServer} from './CommandServer';

// Called by the server side command line 'atom' command.
export function getAtomCommands(): Promise<?AtomCommands> {
  return Promise.resolve(CommandServer.getAtomCommands());
}

export function getConnectionDetails(): Promise<?ConnectionDetails> {
  return CommandServer.getConnectionDetails();
}
