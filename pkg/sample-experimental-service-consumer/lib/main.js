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

import type SimpleConsoleClient from '../../sample-experimental-console-service/lib/SimpleConsoleClient';
import type WindowServiceClient from '../../sample-experimental-window-service/lib/WindowServiceClient';

import {getLogger} from 'log4js';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {initializeLogging} from '../../nuclide-logging';
import WidgetView from './WidgetView';

initializeLogging();
const logger = getLogger('sample-experimental-service-consumer');

export default class Package {
  _disposables: UniversalDisposable = new UniversalDisposable();

  constructor(services: {
    console: SimpleConsoleClient,
    window: WindowServiceClient,
  }) {
    const {console, window} = services;
    logger.info('loaded main.js');

    console.log('test1234');

    window.open({
      width: 300,
      height: 300,
      frame: false,
      createView: () => new WidgetView(),
    });
  }

  dispose(): void {
    this._disposables.dispose();
  }
}
