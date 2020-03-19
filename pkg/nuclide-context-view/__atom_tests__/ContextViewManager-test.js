/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
import type {ContextElementProps, ContextProvider} from '../lib/types';
import type {DefinitionProvider} from 'atom-ide-ui';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {ContextViewManager} from '../lib/ContextViewManager';
import * as React from 'react';
import featureConfig from 'nuclide-commons-atom/feature-config';
import invariant from 'assert';

const PROVIDER1_ID = 'context-provider-1';
const PROVIDER1_TITLE = 'Provider One';
const PROVIDER2_ID = 'context-provider-2';
const PROVIDER2_TITLE = 'Provider Two';

describe('ContextViewManager', () => {
  let manager: ContextViewManager;
  let disposables: UniversalDisposable;
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
    disposables = new UniversalDisposable();

    manager = new ContextViewManager();
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
      wordRegExp: null,
      getDefinition: (editor: TextEditor, position: atom$Point) => {
        return Promise.resolve(null);
      },
    };
    disposables.add(manager);
  });

  afterEach(() => {
    disposables.dispose();
  });

  /** Registration/deregistration API */

  it('correctly registers a single context provider and rerenders', () => {
    jest.spyOn(manager, '_render').mockImplementation(() => {});
    const registered = manager.registerProvider(provider1);
    expect(registered).toBe(true);
    expect(manager._contextProviders.length).toBe(1);
    expect(manager._render).toHaveBeenCalled();
  });
  it('correctly registers multiple context provdiers and rerenders', () => {
    jest.spyOn(manager, '_render').mockImplementation(() => {});
    const registered1 = manager.registerProvider(provider1);
    const registered2 = manager.registerProvider(provider2);
    expect(registered1).toBe(true);
    expect(registered2).toBe(true);
    expect(manager._contextProviders.length).toBe(2);
    expect(manager._render).toHaveBeenCalled();
  });
  it('does not register a provider with an already existing ID', () => {
    const registered1 = manager.registerProvider(provider1);
    const registeredAgain = manager.registerProvider(provider1);
    expect(registered1).toBe(true);
    expect(registeredAgain).toBe(false); // Shouldn't re-register provider with same ID
    expect(manager._contextProviders.length).toBe(1);
  });
  it('unregisters a provider and rerenders', () => {
    jest.spyOn(manager, '_render').mockImplementation(() => {});
    manager.registerProvider(provider1);
    const unregistered = manager.unregisterProvider(PROVIDER1_ID);
    expect(unregistered).toBe(true);
    expect(manager._contextProviders.length).toBe(0);
    expect(manager._render).toHaveBeenCalled();
  });
  it('does not unregister a provider that has not been registered', () => {
    jest.spyOn(manager, '_render').mockImplementation(() => {});
    const unregistered1 = manager.unregisterProvider(PROVIDER1_ID);
    expect(unregistered1).toBe(false);
    expect(manager._contextProviders.length).toBe(0);
    manager.registerProvider(provider1);
    const unregistered2 = manager.unregisterProvider(PROVIDER2_ID);
    expect(unregistered2).toBe(false);
    expect(manager._contextProviders.length).toBe(1);
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
    manager.registerProvider(provider2);
    manager.registerProvider(provider1);
    expect(manager._contextProviders[0].id).toBe(PROVIDER1_ID);
    expect(manager._contextProviders[1].id).toBe(PROVIDER2_ID);

    manager = new ContextViewManager();
    // Insert order: 4, 5, 1, 3, 2
    // Provider list should end up as [1, 2, 3, 4, 5]
    manager.registerProvider(provider4);
    manager.registerProvider(provider5);
    manager.registerProvider(provider1);
    manager.registerProvider(provider3);
    manager.registerProvider(provider2);
    expect(manager._contextProviders[0].id).toBe(PROVIDER1_ID);
    expect(manager._contextProviders[1].id).toBe(PROVIDER2_ID);
    expect(manager._contextProviders[2].id).toBe('3');
    expect(manager._contextProviders[3].id).toBe('4');
    expect(manager._contextProviders[4].id).toBe('5');
  });

  /** Actions affecting definition service subscription */
  it('consumes the definition service when showing', () => {
    manager.show();
    jest.spyOn(manager, 'updateSubscription');
    jest.spyOn(manager, '_render');
    jest.spyOn(manager, '_renderProviders').mockImplementation(() => {});
    manager.consumeDefinitionProvider(defProvider);
    expect(manager.updateSubscription).toHaveBeenCalled();
    expect(manager._defServiceSubscription).toBeTruthy();
    expect(manager._render).toHaveBeenCalled();
    expect(manager._renderProviders).toHaveBeenCalled();
  });
  it('consumes the definition service when hidden', () => {
    jest.spyOn(manager, 'updateSubscription');
    jest.spyOn(manager, '_render');
    jest.spyOn(manager, '_renderProviders').mockImplementation(() => {});
    jest.spyOn(manager, '_disposeView').mockImplementation(() => {});
    expect(manager._defServiceSubscription).toBeNull();
    manager.consumeDefinitionProvider(defProvider);
    expect(manager.updateSubscription).toHaveBeenCalled();
    expect(manager._defServiceSubscription).toBeNull();
    expect(manager._render).toHaveBeenCalled();
    expect(manager._disposeView).toHaveBeenCalled();
    expect(manager._renderProviders).not.toHaveBeenCalled();
  });
  it('hides correctly', () => {
    manager.show();
    manager.consumeDefinitionProvider(defProvider);
    jest.spyOn(manager, '_render');
    jest.spyOn(manager, '_disposeView').mockImplementation(() => {});
    jest.spyOn(manager, 'updateSubscription');
    manager.hide();
    expect(manager._isVisible).toBe(false);
    expect(manager._render).toHaveBeenCalled();
    expect(manager._disposeView).toHaveBeenCalled();
    expect(manager.updateSubscription).toHaveBeenCalled();
    expect(manager._defServiceSubscription).toBeNull();
  });
  it('shows correctly', () => {
    manager.consumeDefinitionProvider(defProvider);
    jest.spyOn(manager, '_render');
    jest.spyOn(manager, '_disposeView').mockImplementation(() => {});
    jest.spyOn(manager, 'updateSubscription');
    manager.show();
    expect(manager._isVisible).toBe(true);
    expect(manager._render).toHaveBeenCalled();
    expect(manager.updateSubscription).toHaveBeenCalled();
  });
  it('disposes correctly', () => {
    manager.show();
    manager.consumeDefinitionProvider(defProvider);
    // i.e. the subscription is unsubscribed if not null
    invariant(
      manager._defServiceSubscription != null,
      'Subscription should exist if panel is visible and def. service consumed',
    );
    const subscription = manager._defServiceSubscription;
    jest.spyOn(subscription, 'unsubscribe').mockImplementation(() => {});
    manager.dispose();
    expect(subscription.unsubscribe).toHaveBeenCalled();
  });
});
