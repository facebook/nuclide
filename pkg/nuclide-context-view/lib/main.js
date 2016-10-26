'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {
  ContextProvider,
  NuclideContextView,
} from './types';
import type {ContextViewConfig} from './ContextViewManager';
import type {DefinitionService} from '../../nuclide-definition-service';
import type {DistractionFreeModeProvider} from '../../nuclide-distraction-free-mode';
import type {GetToolBar} from '../../commons-atom/suda-tool-bar';
import type {HomeFragments} from '../../nuclide-home/lib/types';

import {ContextViewManager} from './ContextViewManager';
import {Disposable, CompositeDisposable} from 'atom';
import invariant from 'assert';

const INITIAL_PANEL_WIDTH = 300;
const INITIAL_PANEL_VISIBILITY = false;

let currentService: ?DefinitionService = null;
let manager: ?ContextViewManager = null;
let disposables: CompositeDisposable;
const initialViewState = {};

export function activate(state?: Object = {}): void {
  initialViewState.width = state.width || INITIAL_PANEL_WIDTH;
  initialViewState.visible = state.visible || INITIAL_PANEL_VISIBILITY;
  disposables = new CompositeDisposable();
  // Toggle
  disposables.add(
    atom.commands.add(
      'atom-workspace',
      'nuclide-context-view:toggle',
      this.toggleContextView.bind(this),
    ),
  );

  // Show
  disposables.add(
    atom.commands.add(
      'atom-workspace',
      'nuclide-context-view:show',
      this.showContextView.bind(this),
    ),
  );

  // Hide
  disposables.add(
    atom.commands.add(
      'atom-workspace',
      'nuclide-context-view:hide',
      this.hideContextView.bind(this),
    ),
  );
}

export function deactivate(): void {
  currentService = null;
  disposables.dispose();
  if (manager != null) {
    manager.consumeDefinitionService(null);
    manager.dispose();
    manager = null;
  }
}

export function serialize(): ?ContextViewConfig {
  if (manager != null) {
    return manager.serialize();
  }
}

/** Returns the singleton ContextViewManager instance of this package, or null
 * if the user doesn't pass the Context View GK check. */
function getContextViewManager(): ContextViewManager {
  if (manager == null) {
    manager = new ContextViewManager(initialViewState.width, initialViewState.visible);
  }
  return manager;
}

export function toggleContextView(): void {
  getContextViewManager().toggle();
}

export function showContextView(): void {
  getContextViewManager().show();
}

export function hideContextView(): void {
  getContextViewManager().hide();
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

export function consumeDefinitionService(service: DefinitionService): IDisposable {
  if (service !== currentService) {
    currentService = service;
    getContextViewManager().consumeDefinitionService(currentService);
  }
  return new Disposable(() => {
    currentService = null;
    if (manager != null) {
      manager.consumeDefinitionService(null);
    }
  });
}

export function consumeToolBar(getToolBar: GetToolBar): IDisposable {
  const toolBar = getToolBar('nuclide-context-view');
  const {element} = toolBar.addButton({
    icon: 'info',
    callback: 'nuclide-context-view:toggle',
    tooltip: 'Toggle Context View',
    priority: 300,
  });
  element.classList.add('nuclide-context-view-toolbar-button');
  const disposable = new Disposable(() => { toolBar.removeItems(); });
  disposables.add(disposable);
  return disposable;
}

export function getDistractionFreeModeProvider(): DistractionFreeModeProvider {
  return {
    name: 'nuclide-context-view',
    isVisible(): boolean {
      return manager != null && manager._isVisible;
    },
    toggle(): void {
      atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'nuclide-context-view:toggle',
      );
    },
  };
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
