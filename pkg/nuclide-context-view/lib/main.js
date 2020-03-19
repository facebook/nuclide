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

import type {ContextProvider, NuclideContextView} from './types';
import type {DefinitionProvider} from 'atom-ide-ui';
import type {HomeFragments} from '../../nuclide-home/lib/types';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {ContextViewManager, WORKSPACE_VIEW_URI} from './ContextViewManager';
import invariant from 'assert';
import {destroyItemWhere} from 'nuclide-commons-atom/destroyItemWhere';

let manager: ?ContextViewManager = null;
let disposables: UniversalDisposable;

export function activate(): void {
  disposables = new UniversalDisposable(_registerCommandAndOpener());
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
  registerProvider(provider: ContextProvider): IDisposable {
    invariant(provider != null, 'Cannot register null context provider');
    const contextViewManager = getContextViewManager();
    contextViewManager.registerProvider(provider);
    return new UniversalDisposable(() => {
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
      description:
        'Easily navigate between symbols and their definitions in your code',
      command: () => {
        // eslint-disable-next-line nuclide-internal/atom-apis
        atom.workspace.open(WORKSPACE_VIEW_URI, {searchAllPanes: true});
      },
    },
    priority: 2,
  };
}

export function deserializeContextViewPanelState(): ContextViewManager {
  return getContextViewManager();
}

function _registerCommandAndOpener(): UniversalDisposable {
  return new UniversalDisposable(
    atom.workspace.addOpener(uri => {
      if (uri === WORKSPACE_VIEW_URI) {
        return getContextViewManager();
      }
    }),
    () => destroyItemWhere(item => item instanceof ContextViewManager),
    atom.commands.add('atom-workspace', 'nuclide-context-view:toggle', () => {
      atom.workspace.toggle(WORKSPACE_VIEW_URI);
    }),
  );
}
