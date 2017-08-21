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

import type {FileResult, Provider} from './types';
import type {HomeFragments} from '../../nuclide-home/lib/types';
import type {CwdApi} from '../../nuclide-current-working-directory/lib/CwdApi';
import type {
  DeepLinkService,
  DeepLinkParams,
} from '../../nuclide-deep-link/lib/types';
import type {QuickSelectionAction} from './QuickSelectionDispatcher';
import type {SelectionIndex} from './QuickSelectionComponent';

import invariant from 'assert';
import React from 'react';
import ReactDOM from 'react-dom';
import QuickSelectionComponent from './QuickSelectionComponent';
import featureConfig from 'nuclide-commons-atom/feature-config';
import {goToLocation} from 'nuclide-commons-atom/go-to-location';
import {track} from '../../nuclide-analytics';
import debounce from 'nuclide-commons/debounce';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import SearchResultManager from './SearchResultManager';
import QuickOpenProviderRegistry from './QuickOpenProviderRegistry';
import QuickSelectionActions from './QuickSelectionActions';
import QuickSelectionDispatcher, {
  ActionTypes,
} from './QuickSelectionDispatcher';

// Don't pre-fill search input if selection is longer than this:
const MAX_SELECTION_LENGTH = 1000;
const ANALYTICS_CHANGE_SELECTION_DEBOUCE = 100;

class Activation {
  _analyticsSessionId: ?string;
  _dispatcherToken: string;
  _previousFocus: ?HTMLElement;
  _searchComponent: ?QuickSelectionComponent;
  _searchPanel: ?atom$Panel;
  _subscriptions: UniversalDisposable;
  _searchResultManager: SearchResultManager;
  _quickOpenProviderRegistry: QuickOpenProviderRegistry;
  _quickSelectionActions: QuickSelectionActions;
  _quickSelectionDispatcher: QuickSelectionDispatcher;

  constructor() {
    this._analyticsSessionId = null;
    this._previousFocus = null;
    this._searchComponent = null;
    this._searchPanel = null;
    this._quickOpenProviderRegistry = new QuickOpenProviderRegistry();
    this._quickSelectionDispatcher = new QuickSelectionDispatcher();
    this._quickSelectionActions = new QuickSelectionActions(
      this._quickSelectionDispatcher,
    );
    this._searchResultManager = new SearchResultManager(
      this._quickOpenProviderRegistry,
    );
    this._dispatcherToken = this._quickSelectionDispatcher.register(
      this._handleActions.bind(this),
    );
    this._subscriptions = new UniversalDisposable(
      atom.commands.add('atom-workspace', {
        'nuclide-quick-open:find-anything-via-omni-search': () => {
          this._quickSelectionActions.changeActiveProvider(
            'OmniSearchResultProvider',
          );
        },
      }),
    );

    (this: any)._handleSelectionChanged = debounce(
      this._handleSelectionChanged.bind(this),
      ANALYTICS_CHANGE_SELECTION_DEBOUCE,
    );

    (this: any)._handleSelection = (this: any)._handleSelection.bind(this);
    (this: any)._closeSearchPanel = (this: any)._closeSearchPanel.bind(this);
  }

  _handleActions(action: QuickSelectionAction): void {
    switch (action.actionType) {
      case ActionTypes.ACTIVE_PROVIDER_CHANGED:
        this._handleActiveProviderChange(action.providerName);
        break;
      case ActionTypes.QUERY:
        this._searchResultManager.executeQuery(action.query);
        break;
    }
  }

  _handleSelection(
    selections: Array<FileResult>,
    providerName: string,
    query: string,
  ): void {
    for (let i = 0; i < selections.length; i++) {
      const selection = selections[i];
      if (selection.callback != null) {
        selection.callback();
      } else {
        goToLocation(selection.path, selection.line, selection.column);
      }
      track('quickopen-select-file', {
        'quickopen-filepath': selection.path,
        'quickopen-query': query,
        // The currently open "tab".
        'quickopen-provider': providerName,
        'quickopen-session': this._analyticsSessionId || '',
        // Because the `provider` is usually OmniSearch, also track the original provider.
        // flowlint-next-line sketchy-null-mixed:off
        'quickopen-provider-source': selection.sourceProvider || '',
      });
    }
    this._closeSearchPanel();
  }

  _handleSelectionChanged(
    selectionIndex: SelectionIndex,
    providerName: string,
    query: string,
  ): void {
    // Only track user-initiated selection-change events.
    if (this._analyticsSessionId != null) {
      track('quickopen-change-selection', {
        'quickopen-selected-index': selectionIndex.selectedItemIndex.toString(),
        'quickopen-selected-service': selectionIndex.selectedService,
        'quickopen-selected-directory': selectionIndex.selectedDirectory,
        'quickopen-session': this._analyticsSessionId,
      });
    }
  }

  _handleActiveProviderChange(newProviderName: string): void {
    /**
     * A "session" for the purpose of analytics. It exists from the moment the
     * quick-open UI becomes visible until it gets closed, either via file
     * selection or cancellation.
     */
    this._analyticsSessionId =
      // flowlint-next-line sketchy-null-string:off
      this._analyticsSessionId || Date.now().toString();
    track('quickopen-change-tab', {
      'quickopen-provider': newProviderName,
      'quickopen-session': this._analyticsSessionId,
    });
    if (
      this._searchPanel != null &&
      this._searchPanel.isVisible() &&
      this._searchResultManager.getActiveProviderName() === newProviderName
    ) {
      // Search panel is already open. Just focus on the query textbox.
      invariant(this._searchComponent != null);
      this._searchComponent.selectAllText();
    } else {
      this._searchResultManager.setActiveProvider(newProviderName);
      this._showSearchPanel();
    }
  }

  _showSearchPanel(initialQuery?: string): void {
    if (this._searchPanel == null) {
      this._searchPanel = atom.workspace.addModalPanel({
        item: document.createElement('div'),
        visible: false,
        className: 'nuclide-quick-open',
      });
    }

    const searchPanel = this._searchPanel;
    invariant(searchPanel != null);

    const searchComponent = ReactDOM.render(
      <QuickSelectionComponent
        quickSelectionActions={this._quickSelectionActions}
        searchResultManager={this._searchResultManager}
        onSelection={this._handleSelection}
        onCancellation={this._closeSearchPanel}
      />,
      searchPanel.getItem(),
    );
    invariant(searchComponent instanceof QuickSelectionComponent);

    if (
      this._searchComponent != null &&
      this._searchComponent !== searchComponent
    ) {
      throw new Error(
        'Only one QuickSelectionComponent can be rendered at a time.',
      );
    }

    // Start a new search "session" for analytics purposes.
    track('quickopen-open-panel', {
      'quickopen-session': this._analyticsSessionId || '',
    });

    if (this._searchComponent == null) {
      this._searchComponent = searchComponent;
      this._previousFocus = document.activeElement;
    }

    if (initialQuery != null) {
      searchComponent.setInputValue(initialQuery);
    } else if (
      !searchPanel.isVisible() &&
      featureConfig.get('nuclide-quick-open.useSelection')
    ) {
      // Only on initial render should you use the current selection as a query.
      const editor = atom.workspace.getActiveTextEditor();
      const selectedText =
        editor != null && editor.getSelections()[0].getText();
      if (selectedText && selectedText.length <= MAX_SELECTION_LENGTH) {
        searchComponent.setInputValue(selectedText.split('\n')[0]);
      }
    }

    if (!searchPanel.isVisible()) {
      searchPanel.show();
      searchComponent.focus();
    }
  }

  _closeSearchPanel(): void {
    if (this._searchComponent != null) {
      invariant(this._searchPanel != null);
      ReactDOM.unmountComponentAtNode(this._searchPanel.getItem());
      this._searchComponent = null;
      track('quickopen-close-panel', {
        'quickopen-session': this._analyticsSessionId || '',
      });
      this._analyticsSessionId = null;
    }

    if (this._searchPanel != null && this._searchPanel.isVisible()) {
      this._searchPanel.hide();
    }

    if (this._previousFocus != null) {
      this._previousFocus.focus();
      this._previousFocus = null;
    }
  }

  registerProvider(service: Provider): IDisposable {
    const subscriptions = new UniversalDisposable(
      this._quickOpenProviderRegistry.addProvider(service),
    );

    // If the provider is renderable and specifies a keybinding, wire it up with
    // the toggle command.
    if (service.display != null && service.display.action != null) {
      subscriptions.add(
        atom.commands.add('atom-workspace', {
          [service.display.action]: () => {
            this._quickSelectionActions.changeActiveProvider(service.name);
          },
        }),
      );
    }

    return subscriptions;
  }

  consumeCWDService(service: CwdApi): IDisposable {
    const disposable = service.observeCwd(dir => {
      this._searchResultManager.setCurrentWorkingRoot(dir);
    });
    this._subscriptions.add(disposable);
    return disposable;
  }

  consumeDeepLinkService(service: DeepLinkService): IDisposable {
    const disposable = service.subscribeToPath(
      'quick-open-query',
      (params: DeepLinkParams): void => {
        const {query} = params;
        if (typeof query === 'string') {
          this._showSearchPanel(query);
        }
      },
    );
    this._subscriptions.add(disposable);
    return disposable;
  }

  dispose(): void {
    this._subscriptions.dispose();
    this._quickSelectionDispatcher.unregister(this._dispatcherToken);
    this._closeSearchPanel();
    if (this._searchPanel != null) {
      this._searchPanel.destroy();
      this._searchPanel = null;
    }
    // SearchResultManager's disposal causes QuickSelectionComponent to do work,
    // so dispose of SearchResultManager after unmounting QuickSelectionComponent.
    this._searchResultManager.dispose();
  }
}

let activation: ?Activation = null;

export function activate(): void {
  activation = new Activation();
}

export function deactivate(): void {
  invariant(activation != null);
  activation.dispose();
  activation = null;
}

export function registerProvider(service: Provider): IDisposable {
  invariant(activation != null);
  return activation.registerProvider(service);
}

export function consumeCWD(cwd: CwdApi): IDisposable {
  invariant(activation != null);
  return activation.consumeCWDService(cwd);
}

export function consumeDeepLinkService(service: DeepLinkService): IDisposable {
  invariant(activation != null);
  return activation.consumeDeepLinkService(service);
}

export function getHomeFragments(): HomeFragments {
  return {
    feature: {
      title: 'Quick Open',
      icon: 'search',
      description:
        'A powerful search box to quickly find local and remote files and content.',
      command: 'nuclide-quick-open:find-anything-via-omni-search',
    },
    priority: 10,
  };
}
