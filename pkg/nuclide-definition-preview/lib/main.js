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
  ContextProvider,
  NuclideContextView,
} from '../../nuclide-context-view/lib/types';

import {DefinitionPreviewView} from './DefinitionPreviewView';
import React from 'react';
import invariant from 'assert';

// Unique ID of this context provider
const PROVIDER_ID: string = 'nuclide-definition-preview';
const PROVIDER_TITLE: string = 'Definition Preview';

class Activation {
  provider: ContextProvider;
  contextViewRegistration: ?IDisposable;

  constructor() {
    this.provider = {
      getElementFactory: () => React.createFactory(DefinitionPreviewView),
      id: PROVIDER_ID,
      title: PROVIDER_TITLE,
    };
  }

  getContextProvider(): ContextProvider {
    return this.provider;
  }

  setContextViewRegistration(registration: IDisposable): void {
    this.contextViewRegistration = registration;
  }

  dispose() {
    if (this.contextViewRegistration != null) {
      this.contextViewRegistration.dispose();
    }
  }
}

let activation: ?Activation = null;

export function activate(state: Object | void) {
  if (activation == null) {
    activation = new Activation();
  }
}

export function deactivate() {
  if (activation != null) {
    activation.dispose();
    activation = null;
  }
}

export async function consumeNuclideContextView(
  contextView: NuclideContextView,
): Promise<void> {
  invariant(activation != null);
  const registration = await contextView.registerProvider(
    activation.getContextProvider(),
  );
  activation.setContextViewRegistration(registration);
}
