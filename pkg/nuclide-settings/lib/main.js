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
  WorkspaceViewsService,
} from '../../nuclide-workspace-views/lib/types';

import {
  viewableFromReactElement,
} from '../../commons-atom/viewableFromReactElement';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import React from 'react';
import SettingsPaneItem, {WORKSPACE_VIEW_URI} from './SettingsPaneItem';

let subscriptions: UniversalDisposable = (null: any);

export function activate(state: ?Object): void {
  subscriptions = new UniversalDisposable();
}

export function deactivate(): void {
  subscriptions.dispose();
  subscriptions = (null: any);
}

export function consumeWorkspaceViewsService(api: WorkspaceViewsService): void {
  subscriptions.add(
    api.addOpener(uri => {
      if (uri === WORKSPACE_VIEW_URI) {
        return viewableFromReactElement(<SettingsPaneItem />);
      }
    }),
    () => api.destroyWhere(item => item instanceof SettingsPaneItem),
    atom.commands.add('atom-workspace', 'nuclide-settings:toggle', event => {
      api.toggle(WORKSPACE_VIEW_URI, (event: any).detail);
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
