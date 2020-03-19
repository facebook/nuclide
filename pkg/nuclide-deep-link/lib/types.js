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

import type {DeepLinkParams} from '../../commons-atom/deep-link';
import type {BrowserWindow} from 'nuclide-commons/electron-remote';

export type {DeepLinkParams};

export type DeepLinkService = {
  /**
   * Subscribes to all links of the form atom://nuclide/path?a=x,b=y,...
   * Trailing slashes will be stripped off the path.
   * Query parameters will be parsed and provided to the callback.
   */
  subscribeToPath(
    path: string,
    callback: (params: DeepLinkParams) => mixed,
  ): IDisposable,

  /**
   * Manually send a deep link to another Atom window.
   */
  sendDeepLink(
    browserWindow: BrowserWindow,
    path: string,
    params: DeepLinkParams,
  ): void,
};
