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

import {destroyItemWhere} from 'nuclide-commons-atom/destroyItemWhere';
import {viewableFromReactElement} from '../../commons-atom/viewableFromReactElement';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Playground} from './Playground';
import {WORKSPACE_VIEW_URI} from './constants';
import invariant from 'assert';
import * as React from 'react';

let disposables: ?UniversalDisposable = null;

export function activate(): void {
  disposables = registerCommandAndOpener();
}

export function deactivate(): void {
  invariant(disposables != null);
  disposables.dispose();
  disposables = null;
}

function registerCommandAndOpener(): UniversalDisposable {
  return new UniversalDisposable(
    atom.workspace.addOpener(uri => {
      if (uri === WORKSPACE_VIEW_URI) {
        return viewableFromReactElement(<Playground />);
      }
    }),
    () => destroyItemWhere(item => item instanceof Playground),
    // eslint-disable-next-line nuclide-internal/atom-apis
    atom.commands.add('atom-workspace', 'nuclide-ui-playground:toggle', () => {
      atom.workspace.toggle(WORKSPACE_VIEW_URI);
    }),
  );
}

export function deserializeSampleUiPlayground(): atom$PaneItem {
  return viewableFromReactElement(<Playground />);
}
