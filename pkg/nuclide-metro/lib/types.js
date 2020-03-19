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

import type {ConsoleSourceStatus} from 'atom-ide-ui';

export type TunnelBehavior =
  | 'open_tunnel_if_needed'
  | 'ask_about_tunnel'
  | 'do_not_open_tunnel';

// Manages starting Metro for the current working root and integrating it into Console.
// Use this service instead of starting Metro via nuclide-metro-rpc yourself.
export interface MetroAtomService {
  start(tunnelBehavior: TunnelBehavior): Promise<void>;
  stop(): void;
  reloadApp(): void;
  restart(): void;
  observeStatus(callback: (ConsoleSourceStatus) => void): IDisposable;
}
