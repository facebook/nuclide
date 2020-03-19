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

import type {ServiceConnection} from 'nuclide-commons-atom/experimental-packages/types';

import invariant from 'assert';
import {getLogger} from 'log4js';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {initializeLogging} from '../../nuclide-logging';
import {remote} from 'electron';
import connectClient from './connectClient';

invariant(remote != null);

initializeLogging();
const logger = getLogger('sample-experimental-window-service');

export default class WindowServicePackage {
  _disposables: UniversalDisposable;

  constructor(
    services: {},
    serviceConsumers: {
      window: Array<ServiceConnection>,
    },
  ) {
    logger.info('loaded main.js');
    logger.info('access to the atom global:', typeof atom === 'object');
    this._disposables = new UniversalDisposable(
      ...serviceConsumers.window.map(connectClient),
    );
  }

  dispose(): void {
    logger.info('disposing window service package!');
    this._disposables.dispose();
  }
}
