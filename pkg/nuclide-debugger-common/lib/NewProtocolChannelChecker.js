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

import passesGK from '../../commons-node/passesGK';

export function isNewProtocolChannelEnabled(): Promise<boolean> {
  if (atom.config.get('nuclide.nuclide-debugger.forceNewChannel')) {
    return Promise.resolve(true);
  }
  return passesGK('nuclide_new_debugger_protocol_channel', 10 * 1000);
}
