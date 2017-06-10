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
import Inspector, {WORKSPACE_VIEW_URI} from './ui/Inspector';
import invariant from 'assert';
import React from 'react';

let disposables: ?UniversalDisposable = null;

export function activate(): void {
  disposables = new UniversalDisposable();
}

export function deactivate(): void {
  invariant(disposables != null);
  disposables.dispose();
  disposables = null;
}

export function consumeWorkspaceViewsService(api: WorkspaceViewsService): void {
  invariant(disposables != null);
  disposables.add(
    api.addOpener(uri => {
      if (uri === WORKSPACE_VIEW_URI) {
        return viewableFromReactElement(<Inspector />);
      }
    }),
    () => api.destroyWhere(item => item instanceof Inspector),
    atom.commands.add(
      'atom-workspace',
      'nuclide-react-inspector:toggle',
      event => {
        api.toggle(WORKSPACE_VIEW_URI, (event: any).detail);
      },
    ),
  );
}
