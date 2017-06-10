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

import type {ContextElementProps, ContextProvider} from '../lib/types';
import type {DefinitionProvider} from 'atom-ide-ui';

import {CompositeDisposable} from 'atom';
import {ContextViewManager} from '../lib/ContextViewManager';
import React from 'react';
import featureConfig from 'nuclide-commons-atom/feature-config';
import invariant from 'assert';

const PROVIDER1_ID = 'context-provider-1';
const PROVIDER1_TITLE = 'Provider One';
const PROVIDER2_ID = 'context-provider-2';
const PROVIDER2_TITLE = 'Provider Two';

describe('ContextViewManager', () => {
  let managerShowing: ContextViewManager; // Initialized as showing
  let managerHidden: ContextViewManager; // Initialized as hidden
  let disposables: CompositeDisposable;
  let provider1: ContextProvider;
  let provider2: ContextProvider;
  const provider1Priority = 1;
  const provider2Priority = 2;
  const provider3Priority = 3;
  const provider4Priority = 4;
  const provider5Priority = 5;
  let defProvider: DefinitionProvider;

  function elementFactory() {
    return (props: ContextElementProps) => {
      return <div>Some context provider view</div>;
    };
  }

  beforeEach(() => {
    disposables = new CompositeDisposable();

    managerShowing = new ContextViewManager();
    managerShowing.show();
    managerHidden = new ContextViewManager();
    provider1 = {
      getElementFactory: elementFactory,
      id: PROVIDER1_ID,
      title: PROVIDER1_TITLE,
      priority: 1,
    };
    provider2 = {
      getElementFactory: elementFactory,
      id: PROVIDER2_ID,
      title: PROVIDER2_TITLE,
      priority: 2,
    };
    featureConfig.set(provider1.id.concat('.priority'), provider1Priority);
    featureConfig.set(provider2.id.concat('.priority'), provider2Priority);
    defProvider = {
      priority: 1,
      grammarScopes: ['text.plain.null-grammar'],
      getDefinition: (editor: TextEditor, position: atom$Point) => {
        return Promise.resolve(null);
      },
    };
    disposables.add(managerShowing);
    disposables.add(managerHidden);
  });

  afterEach(() => {
    disposables.dispose();
  });

  /** Registration/deregistration API */

  it('correctly registers a single context provider and rerenders', () => {
    spyOn(managerShowing, '_render');
    const registered = managerShowing.registerProvider(provider1);
    expect(registered).toBe(true);
    expect(managerShowing._contextProviders.length).toBe(1);
    expect(managerShowing._render).toHaveBeenCalled();
  });
  it('correctly registers multiple context provdiers and rerenders', () => {
    spyOn(managerShowing, '_render');
    const registered1 = managerShowing.registerProvider(provider1);
    const registered2 = managerShowing.registerProvider(provider2);
    expect(registered1).toBe(true);
    expect(registered2).toBe(true);
    expect(managerShowing._contextProviders.length).toBe(2);
    expect(managerShowing._render).toHaveBeenCalled();
  });
  it('does not register a provider with an already existing ID', () => {
    const registered1 = managerShowing.registerProvider(provider1);
    const registeredAgain = managerShowing.registerProvider(provider1);
    expect(registered1).toBe(true);
    expect(registeredAgain).toBe(false); // Shouldn't re-register provider with same ID
    expect(managerShowing._contextProviders.length).toBe(1);
  });
  it('unregisters a provider and rerenders', () => {
    spyOn(managerShowing, '_render');
    managerShowing.registerProvider(provider1);
    const unregistered = managerShowing.unregisterProvider(PROVIDER1_ID);
    expect(unregistered).toBe(true);
    expect(managerShowing._contextProviders.length).toBe(0);
    expect(managerShowing._render).toHaveBeenCalled();
  });
  it('does not unregister a provider that has not been registered', () => {
    spyOn(managerShowing, '_render');
    const unregistered1 = managerShowing.unregisterProvider(PROVIDER1_ID);
    expect(unregistered1).toBe(false);
    expect(managerShowing._contextProviders.length).toBe(0);
    managerShowing.registerProvider(provider1);
    const unregistered2 = managerShowing.unregisterProvider(PROVIDER2_ID);
    expect(unregistered2).toBe(false);
    expect(managerShowing._contextProviders.length).toBe(1);
  });
  it('orders providers based on priority', () => {
    const provider3 = {
      getElementFactory: elementFactory,
      id: '3',
      title: '3',
      priority: 3,
    };
    const provider4 = {
      getElementFactory: elementFactory,
      id: '4',
      title: '4',
      priority: 4,
    };
    const provider5 = {
      getElementFactory: elementFactory,
      id: '5',
      title: '5',
      priority: 5,
    };
    featureConfig.set(provider3.id.concat('.priority'), provider3Priority);
    featureConfig.set(provider4.id.concat('.priority'), provider4Priority);
    featureConfig.set(provider5.id.concat('.priority'), provider5Priority);
    managerHidden.registerProvider(provider2);
    managerHidden.registerProvider(provider1);
    expect(managerHidden._contextProviders[0].id).toBe(PROVIDER1_ID);
    expect(managerHidden._contextProviders[1].id).toBe(PROVIDER2_ID);
    // Insert order: 4, 5, 1, 3, 2
    // Provider list should end up as [1, 2, 3, 4, 5]
    managerShowing.registerProvider(provider4);
    managerShowing.registerProvider(provider5);
    managerShowing.registerProvider(provider1);
    managerShowing.registerProvider(provider3);
    managerShowing.registerProvider(provider2);
    expect(managerShowing._contextProviders[0].id).toBe(PROVIDER1_ID);
    expect(managerShowing._contextProviders[1].id).toBe(PROVIDER2_ID);
    expect(managerShowing._contextProviders[2].id).toBe('3');
    expect(managerShowing._contextProviders[3].id).toBe('4');
    expect(managerShowing._contextProviders[4].id).toBe('5');
  });

  /** Actions affecting definition service subscription */
  it('consumes the definition service when showing', () => {
    spyOn(managerShowing, 'updateSubscription').andCallThrough();
    spyOn(managerShowing, '_render').andCallThrough();
    spyOn(managerShowing, '_renderProviders');
    managerShowing.consumeDefinitionProvider(defProvider);
    expect(managerShowing.updateSubscription).toHaveBeenCalled();
    expect(managerShowing._defServiceSubscription).toBeTruthy();
    expect(managerShowing._render).toHaveBeenCalled();
    expect(managerShowing._renderProviders).toHaveBeenCalled();
  });
  it('consumes the definition service when hidden', () => {
    spyOn(managerHidden, 'updateSubscription').andCallThrough();
    spyOn(managerHidden, '_render').andCallThrough();
    spyOn(managerHidden, '_renderProviders');
    spyOn(managerHidden, '_disposeView');
    expect(managerHidden._defServiceSubscription).toBeNull();
    managerHidden.consumeDefinitionProvider(defProvider);
    expect(managerHidden.updateSubscription).toHaveBeenCalled();
    expect(managerHidden._defServiceSubscription).toBeNull();
    expect(managerHidden._render).toHaveBeenCalled();
    expect(managerHidden._disposeView).toHaveBeenCalled();
    expect(managerHidden._renderProviders).not.toHaveBeenCalled();
  });
  it('shows and hides correctly', () => {
    managerShowing.consumeDefinitionProvider(defProvider);
    managerHidden.consumeDefinitionProvider(defProvider);
    spyOn(managerShowing, '_render').andCallThrough();
    spyOn(managerShowing, '_disposeView');
    spyOn(managerShowing, 'updateSubscription').andCallThrough();
    spyOn(managerHidden, '_render').andCallThrough();
    spyOn(managerHidden, '_disposeView');
    spyOn(managerHidden, 'updateSubscription').andCallThrough();
    managerShowing.hide();
    expect(managerShowing._isVisible).toBe(false);
    expect(managerShowing._render).toHaveBeenCalled();
    expect(managerShowing._disposeView).toHaveBeenCalled();
    expect(managerShowing.updateSubscription).toHaveBeenCalled();
    expect(managerShowing._defServiceSubscription).toBeNull();
    managerHidden.show();
    expect(managerHidden._isVisible).toBe(true);
    expect(managerHidden._render).toHaveBeenCalled();
    expect(managerHidden.updateSubscription).toHaveBeenCalled();
  });
  it('disposes correctly', () => {
    managerShowing.consumeDefinitionProvider(defProvider);
    // i.e. the subscription is unsubscribed if not null
    invariant(
      managerShowing._defServiceSubscription != null,
      'Subscription should exist if panel is visible and def. service consumed',
    );
    const subscription = managerShowing._defServiceSubscription;
    spyOn(subscription, 'unsubscribe');
    managerShowing.dispose();
    expect(subscription.unsubscribe).toHaveBeenCalled();
  });
});
