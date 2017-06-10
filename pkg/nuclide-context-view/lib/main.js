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

import type {ContextProvider, NuclideContextView} from './types';
import type {DefinitionProvider} from 'atom-ide-ui';
import type {HomeFragments} from '../../nuclide-home/lib/types';
import type {
  WorkspaceViewsService,
} from '../../nuclide-workspace-views/lib/types';

import {ContextViewManager, WORKSPACE_VIEW_URI} from './ContextViewManager';
import {Disposable, CompositeDisposable} from 'atom';
import invariant from 'assert';

let manager: ?ContextViewManager = null;
let disposables: CompositeDisposable;

export function activate(): void {
  disposables = new CompositeDisposable();
}

export function deactivate(): void {
  disposables.dispose();
  if (manager != null) {
    manager.dispose();
    manager = null;
  }
}

/** Returns the singleton ContextViewManager instance of this package, or null
 * if the user doesn't pass the Context View GK check. */
function getContextViewManager(): ContextViewManager {
  if (manager == null) {
    manager = new ContextViewManager();
  }
  return manager;
}

/**
 * This is the context view service that other Nuclide packages consume when they
 * want to provide context for a definition. A context provider must consume the
 * nuclide-context-view service and register themselves as a provider.
 */
const Service: NuclideContextView = {
  registerProvider(provider: ContextProvider): Disposable {
    invariant(provider != null, 'Cannot register null context provider');
    const contextViewManager = getContextViewManager();
    contextViewManager.registerProvider(provider);
    return new Disposable(() => {
      contextViewManager.unregisterProvider(provider.id);
    });
  },
};

export function consumeDefinitionProvider(
  provider: DefinitionProvider,
): IDisposable {
  return getContextViewManager().consumeDefinitionProvider(provider);
}

export function provideNuclideContextView(): NuclideContextView {
  return Service;
}

export function getHomeFragments(): HomeFragments {
  return {
    feature: {
      title: 'Context View',
      icon: 'info',
      description: 'Easily navigate between symbols and their definitions in your code',
      command: () => {
        atom.commands.dispatch(
          atom.views.getView(atom.workspace),
          'nuclide-context-view:toggle',
          {visible: true},
        );
      },
    },
    priority: 2,
  };
}

export function deserializeContextViewPanelState(): ContextViewManager {
  return getContextViewManager();
}

export function consumeWorkspaceViewsService(api: WorkspaceViewsService): void {
  disposables.add(
    api.addOpener(uri => {
      if (uri === WORKSPACE_VIEW_URI) {
        return getContextViewManager();
      }
    }),
    new Disposable(() =>
      api.destroyWhere(item => item instanceof ContextViewManager),
    ),
    atom.commands.add(
      'atom-workspace',
      'nuclide-context-view:toggle',
      event => {
        api.toggle(WORKSPACE_VIEW_URI, (event: any).detail);
      },
    ),
  );
}
