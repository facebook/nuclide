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
  DefinitionService,
} from '../../nuclide-definition-service';
import type {
  Definition,
  DefinitionQueryResult,
} from '../../nuclide-definition-service/lib/rpc-types';
import type {EditorPosition} from '../../commons-atom/debounced';
import type {ContextProvider} from './types';

import invariant from 'assert';
import featureConfig from '../../commons-atom/featureConfig';
import {arrayCompact} from '../../commons-node/collection';
import {React, ReactDOM} from 'react-for-atom';
import {observeTextEditorsPositions} from '../../commons-atom/debounced';
import {Observable} from 'rxjs';
import {track, trackTiming} from '../../nuclide-analytics';
import {getLogger} from '../../nuclide-logging';
import ContextViewMessage from './ContextViewMessage';
import {ContextViewPanel} from './ContextViewPanel';
import {ProviderContainer} from './ProviderContainer';
import {NoProvidersView} from './NoProvidersView';

const EDITOR_DEBOUNCE_INTERVAL = 500;
const POSITION_DEBOUNCE_INTERVAL = 500;
export const WORKSPACE_VIEW_URI = 'atom://nuclide/context-view';

type SerializedContextViewPanelState = {
  deserializer: 'nuclide.ContextViewPanelState',
};

const logger = getLogger();

/**
 * Manages registering/unregistering of definition service and context providers,
 * and manages re-rendering when a new definition is emitted from the definition
 * service.
 */
export class ContextViewManager {
  _contextProviders: Array<ContextProvider>;
  _defServiceSubscription: ?rxjs$ISubscription;
  // Subscriptions to all changes in registered context providers' `priority` setting.
  //    Key: ID of the context provider
  //    Value: Disposable for the change event subscription on its priority setting
  _settingDisposables: Map<string, IDisposable>;
  _definitionService: ?DefinitionService;
  _isVisible: boolean;
  // Whether Context View should keep displaying the current content even after the cursor moves
  _locked: boolean;
  _panelDOMElement: HTMLElement;
  currentDefinition: ?Definition;

  constructor() {
    this._contextProviders = [];
    this._defServiceSubscription = null;
    this._settingDisposables = new Map();
    this._definitionService = null;
    this._isVisible = false;
    this._locked = false; // Should be unlocked by default
    this.currentDefinition = null;

    (this: any).hide = this.hide.bind(this);
    (this: any)._setLocked = this._setLocked.bind(this);

    this._panelDOMElement = document.createElement('div');
    this._panelDOMElement.style.display = 'flex';

    this._render();
  }

  dispose(): void {
    this._disposeView();
    this._settingDisposables.forEach(disposable => {
      disposable.dispose();
    });
  }

  hide(): void {
    track('nuclide-context-view:hide');
    if (this._isVisible) {
      this._isVisible = false;
      this._render();
    }
    this.updateSubscription();
  }

  registerProvider(newProvider: ContextProvider): boolean {
    // Ensure provider with given ID isn't already registered,
    // and find index to insert at based on priority
    let insertIndex = -1;
    let foundIndex = false;
    const keyPath = newProvider.id + '.priority';
    const newPriority: number = (featureConfig.get(keyPath): any);
    const providers = this._contextProviders;
    for (let i = 0; i < providers.length; i++) {
      if (newProvider.id === providers[i].id) {
        return false;
      }
      const existingPriority: number =
        (featureConfig.get(providers[i].id + '.priority'): any);
      if (!foundIndex && newPriority <= existingPriority) {
        insertIndex = i;
        foundIndex = true;
      }
    }
    if (insertIndex === -1) {
      insertIndex = providers.length;
    }
    this._contextProviders.splice(insertIndex, 0, newProvider);
    const disposable = featureConfig.observe(keyPath, newValue => {
      this._sortProvidersBasedOnPriority();
    });
    this._settingDisposables.set(newProvider.id, disposable);
    this._render();
    return true;
  }


  _sortProvidersBasedOnPriority(): void {
    this._contextProviders.sort((provider1, provider2) => {
      const priority1: number = (featureConfig.get(provider1.id + '.priority'): any);
      const priority2: number = (featureConfig.get(provider2.id + '.priority'): any);
      return priority1 - priority2;
    });
    this._render();
  }

  /**
   * Sets handle to registered definition service, sets the subscriber
   * to the definition service to an Observable<Definition>, and
   * re-renders if necessary.
   */
  consumeDefinitionService(service: ?DefinitionService): void {
    this._definitionService = service;
    this.updateSubscription();
    this._render();
  }

  /**
   * Subscribes or unsubscribes to definition service based on the current state.
   */
  updateSubscription(): void {
    // Only subscribe if panel showing && there's something to subscribe to && not locked
    if (this._isVisible && this._definitionService != null && !this._locked) {
      this._defServiceSubscription = observeTextEditorsPositions(
        EDITOR_DEBOUNCE_INTERVAL, POSITION_DEBOUNCE_INTERVAL)
        .filter((editorPos: ?EditorPosition) => editorPos != null)
        .map((editorPos: ?EditorPosition) => {
          return trackTiming('nuclide-context-view:getDefinition', () => {
            invariant(editorPos != null);
            invariant(this._definitionService != null);
            return this._definitionService.getDefinition(editorPos.editor, editorPos.position)
              .catch(error => {
                logger.error('Error querying definition service: ', error);
                return null;
              });
          });
        }).switchMap((queryResult: Promise<?DefinitionQueryResult>) => {
          return (queryResult != null)
            ? Observable.fromPromise(queryResult)
            : Observable.empty();
        })
        .map((queryResult: ?DefinitionQueryResult) => {
          if (queryResult != null) {
            track('nuclide-context-view:filterQueryResults', {
              definitionsReturned: queryResult.definitions.length,
            });
            // TODO (@reesjones) Handle case where multiple definitions are shown
            return queryResult.definitions[0];
          }
          // We do want to return null sometimes so providers can show "No definition selected"
          return null;
        })
        .subscribe((def: ?Definition) => this.updateCurrentDefinition(def));
      return;
    }
    // Otherwise, unsubscribe if there is a subscription
    if (this._defServiceSubscription != null) {
      this._defServiceSubscription.unsubscribe();
      this._defServiceSubscription = null;
    }
  }

  show(): void {
    track('nuclide-context-view:show');
    if (!this._isVisible) {
      this._isVisible = true;
      this._render();
    }
    this.updateSubscription();
  }

  toggle(): void {
    if (this._isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  unregisterProvider(idToRemove: string): boolean {
    let wasRemoved: boolean = false;
    for (let i = 0; i < this._contextProviders.length; i++) {
      if (this._contextProviders[i].id === idToRemove) {
        // Remove from array
        this._contextProviders.splice(i, 1);
        // Unsubscribe from change events on the removed provider's `priority` setting
        const settingChangeListener = this._settingDisposables.get(idToRemove);
        if (settingChangeListener != null) {
          settingChangeListener.dispose();
        }
        this._settingDisposables.delete(idToRemove);
        wasRemoved = true;
      }
    }
    this._render();
    return wasRemoved;
  }

  updateCurrentDefinition(newDefinition: ?Definition) {
    if (newDefinition === this.currentDefinition) {
      return;
    }

    this.currentDefinition = newDefinition;
    this._render();
  }

  _setLocked(locked: boolean): void {
    if (locked !== this._locked) {
      this._locked = locked;
      this.updateSubscription();
      this._render();
    }
  }

  _disposeView(): void {
    ReactDOM.unmountComponentAtNode(this._panelDOMElement);
    if (this._defServiceSubscription != null) {
      this._defServiceSubscription.unsubscribe();
      this._defServiceSubscription = null;
    }
  }

  _renderProviders(): void {
    // Create collection of provider React elements to render, and
    // display them in order
    const providerElements: Array<React.Element<any>> = arrayCompact(
      this._contextProviders.map((prov, index) => {
        const createElementFn = prov.getElementFactory();
        const element = createElementFn({
          ContextViewMessage,
          definition: this.currentDefinition,
          setLocked: this._setLocked,
        });
        if (element != null) {
          return (
            <ProviderContainer title={prov.title} key={index}>
              {element}
            </ProviderContainer>
          );
        }
      }),
    );

    // If there are no context providers to show, show a message instead
    if (providerElements.length === 0) {
      providerElements.push(<NoProvidersView key={0} />);
    }

    ReactDOM.render(
      <ContextViewPanel
        definition={this.currentDefinition}
        locked={this._locked}>
        {providerElements}
      </ContextViewPanel>,
      this._panelDOMElement,
    );
  }

  _render(): void {
    if (this._isVisible) {
      this._renderProviders();
    } else {
      this._disposeView();
    }
  }

  getTitle() {
    return 'Context View';
  }

  getIconName() {
    return 'info';
  }

  getPreferredInitialWidth(): number {
    return 300;
  }

  getURI(): string {
    return WORKSPACE_VIEW_URI;
  }

  getDefaultLocation(): string {
    return 'right-panel';
  }

  didChangeVisibility(visible: boolean): void {
    if (visible) {
      this.show();
    } else {
      this.hide();
    }
  }

  getElement(): HTMLElement {
    return this._panelDOMElement;
  }

  serialize(): SerializedContextViewPanelState {
    return {
      deserializer: 'nuclide.ContextViewPanelState',
    };
  }
}
