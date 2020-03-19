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

import type {ConnectionDetails, MultiConnectionAtomCommands} from './rpc-types';

import {getCommandServer} from './command-server-singleton';

// This file defines a service that is expected to be used by
// command-line tools that run local to a Nuclide server.
// To that end, it is defined in ../services-3.json, which can
// be loaded via the Nuclide-RPC framework.

export function getAtomCommands(): Promise<MultiConnectionAtomCommands> {
  return Promise.resolve(getCommandServer().getMultiConnectionAtomCommands());
}

export function getConnectionDetails(): Promise<?ConnectionDetails> {
  return getCommandServer().getConnectionDetails();
}
