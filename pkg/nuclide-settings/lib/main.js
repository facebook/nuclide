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

import type {
  DeepLinkService,
  DeepLinkParams,
} from '../../nuclide-deep-link/lib/types';

import {goToLocation} from 'nuclide-commons-atom/go-to-location';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import querystring from 'querystring';
import SettingsPaneItem, {WORKSPACE_VIEW_URI} from './SettingsPaneItem';
import {destroyItemWhere} from 'nuclide-commons-atom/destroyItemWhere';
import openSettingsView from './openSettingsView';

let subscriptions: UniversalDisposable = (null: any);

export function activate(state: ?Object): void {
  subscriptions = new UniversalDisposable(registerCommandAndOpener());
}

export function deactivate(): void {
  subscriptions.dispose();
  subscriptions = (null: any);
}

function registerCommandAndOpener(): UniversalDisposable {
  return new UniversalDisposable(
    atom.workspace.addOpener(openSettingsView),
    () => destroyItemWhere(item => item instanceof SettingsPaneItem),
    atom.commands.add('atom-workspace', 'nuclide-settings:toggle', () => {
      atom.workspace.toggle(WORKSPACE_VIEW_URI);
    }),
  );
}

export function consumeToolBar(getToolBar: toolbar$GetToolbar): IDisposable {
  const toolBar = getToolBar('nuclide-home');
  toolBar.addSpacer({
    priority: -501,
  });
  toolBar.addButton({
    icon: 'gear',
    callback: 'nuclide-settings:toggle',
    tooltip: 'Open Nuclide Settings',
    priority: -500,
  });
  const disposable = new UniversalDisposable(() => {
    toolBar.removeItems();
  });
  subscriptions.add(disposable);
  return disposable;
}

export function consumeDeepLinkService(service: DeepLinkService): IDisposable {
  const disposable = service.subscribeToPath(
    'settings',
    (params: DeepLinkParams): void => {
      const {filter} = params;
      let uri = WORKSPACE_VIEW_URI;
      if (typeof filter === 'string') {
        uri += '?' + querystring.stringify({filter});
      }
      goToLocation(uri);
    },
  );
  subscriptions.add(disposable);
  return disposable;
}
