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

import type {MessageConnection} from 'vscode-jsonrpc';
import type {ServiceConnection} from 'nuclide-commons-atom/experimental-packages/types';
import type {
  OpenParams,
  UpdateParams,
  DestroyParams,
} from './WindowServiceClient';

import invariant from 'assert';
import {getLogger} from 'log4js';
import {remote} from 'electron';
import {BrowserWindow} from 'nuclide-commons/electron-remote';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import nullthrows from 'nullthrows';
import path from 'path'; // eslint-disable-line nuclide-internal/prefer-nuclide-uri

const logger = getLogger('sample-experimental-window-service.connectClient');

invariant(remote != null);

let windowCount = 1;
const windowManagers: Map<number, WindowManager> = new Map();
const windowManagersToConnections: WeakMap<
  WindowManager,
  MessageConnection,
> = new WeakMap();

// TODO: Actually get this information from package.json files.
const viewRegistry = new Map([
  [
    'sample-experimental-service-consumer.WidgetComponent',
    path.join(
      __dirname,
      '../../sample-experimental-service-consumer/lib/WidgetComponent',
    ),
  ],
]);

// Route messages from the windows to the correct connection.
remote.ipcMain.on('dispatch', (_, {windowId, action}) => {
  logger.info(
    `client handling action from window ${windowId}: ${JSON.stringify(action)}`,
  );
  const windowManager = nullthrows(windowManagers.get(windowId));
  const connection = nullthrows(windowManagersToConnections.get(windowManager));
  connection.sendNotification('dispatch', {action});
});

export default function connectClient(
  connection: ServiceConnection,
): IDisposable {
  const disposables = new UniversalDisposable();
  connection.onRequest(
    {method: 'open'},
    (params: OpenParams<*>): number => {
      logger.info('got create request:', params);
      if (disposables.disposed) {
        throw new Error('attempted to open after dispose');
      }
      const windowId = windowCount++;
      const windowManager = new WindowManager({
        windowId,
        openParams: params,
        onDestroy: () => {
          disposables.dispose();
        },
      });
      windowManagers.set(windowId, windowManager);
      windowManagersToConnections.set(windowManager, connection);
      disposables.add(() => {
        logger.info('disposing of connection to window client!');
        windowManagers.delete(windowId);
        windowManagersToConnections.delete(windowManager);
        windowManager.destroy();
      });
      return windowId;
    },
  );
  connection.onNotification({method: 'update'}, (params: UpdateParams<*>) => {
    logger.info('got update request:', params);
    const windowManager = nullthrows(windowManagers.get(params.id));
    windowManager.update(params.update);
  });
  connection.onNotification({method: 'destroy'}, (params: DestroyParams) => {
    logger.info('got destroy request:', params.id);
    disposables.dispose();
  });
  return disposables;
}

// An object that abstracts away the asynchronous nature of window creation/initialization. We could
// also do this (probably more elegantly) with Rx, but that's a heavy dep.
class WindowManager {
  _initPromise: Promise<?BrowserWindow>;
  _destroyed: boolean = false;
  _windowId: number;
  _onDestroy: () => mixed;

  constructor(options: {
    windowId: number,
    openParams: OpenParams<*>,
    onDestroy: () => mixed,
  }) {
    const {windowId, openParams, onDestroy} = options;
    this._windowId = windowId;
    this._onDestroy = onDestroy;
    this._initPromise = this._init(windowId, openParams);
  }

  async _init(
    windowId: number,
    params: OpenParams<*>,
  ): Promise<?BrowserWindow> {
    const win = new BrowserWindow({
      width: params.width,
      height: params.height,
      frame: params.frame,
      show: false,
    });
    win.loadURL(`file://${__dirname}/index.html`);

    win.on('closed', () => {
      this.destroy();
    });

    await new Promise(resolve => {
      win.webContents.on('did-finish-load', resolve);
    });

    if (this._destroyed) {
      return null;
    }

    // Initialize the new window.
    const {view} = params;
    /* const componentModule = */ win.webContents.send('initialize', {
      windowId,
      componentModule: nullthrows(viewRegistry.get(view.componentId)),
      initialState: view.initialState,
    });

    // TODO: Wait until first render is complete to show?
    win.show();

    return win;
  }

  update(update: Object): void {
    this._initPromise.then(win => {
      if (this._destroyed || win == null) {
        return;
      }
      win.webContents.send('update', update);
    });
  }

  destroy(): void {
    if (this._destroyed) {
      return;
    }
    logger.info(`window ${this._windowId} destruction requested`);
    this._destroyed = true;
    this._onDestroy();
    this._initPromise.then(win => {
      if (win != null) {
        logger.info(`destroying window ${this._windowId}`);
        win.destroy();
      }
    });
  }
}
