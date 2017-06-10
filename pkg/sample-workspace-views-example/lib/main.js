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
import {ExampleGadgetA, WORKSPACE_VIEW_URI_A} from './ExampleGadgetA';
import {ExampleGadgetB, WORKSPACE_VIEW_URI_B} from './ExampleGadgetB';
import invariant from 'assert';
import React from 'react';

let disposables: ?UniversalDisposable = null;

export function activate() {
  disposables = new UniversalDisposable();
}

// This example shows two different ways to create a gadget: ExampleGadgetA stores its state in a
// separate model object while ExampleGadgetB stores its state in a React element.

export function consumeWorkspaceViewsService(api: WorkspaceViewsService): void {
  invariant(disposables != null);

  // Option A
  disposables.add(
    api.addOpener(uri => {
      if (uri === WORKSPACE_VIEW_URI_A) {
        return new ExampleGadgetA();
      }
    }),
    () => api.destroyWhere(item => item instanceof ExampleGadgetA),
    atom.commands.add(
      'atom-workspace',
      'sample-toggle-example-gadget-a:toggle',
      event => {
        api.toggle(WORKSPACE_VIEW_URI_A, (event: any).detail);
      },
    ),
  );

  // Option B
  disposables.add(
    api.addOpener(uri => {
      if (uri === WORKSPACE_VIEW_URI_B) {
        return viewableFromReactElement(<ExampleGadgetB />);
      }
    }),
    () => api.destroyWhere(item => item instanceof ExampleGadgetB),
    atom.commands.add(
      'atom-workspace',
      'sample-toggle-example-gadget-b:toggle',
      event => {
        api.toggle(WORKSPACE_VIEW_URI_B, (event: any).detail);
      },
    ),
  );
}

export function deserializeExampleGadgetA() {
  return new ExampleGadgetA();
}

export function deserializeExampleGadgetB() {
  return viewableFromReactElement(<ExampleGadgetB />);
}

export function deactivate(): void {
  invariant(disposables != null);
  disposables.dispose();
  disposables = null;
}
