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

import invariant from 'assert';

// eslint-disable-next-line nuclide-internal/no-cross-atom-imports
import * as main from '../../pkg/nuclide-file-tree/lib/main';
// eslint-disable-next-line nuclide-internal/no-cross-atom-imports
import * as Actions from '../../pkg/nuclide-file-tree/lib/redux/Actions';
// eslint-disable-next-line nuclide-internal/no-cross-atom-imports
import * as Selectors from '../../pkg/nuclide-file-tree/lib/redux/Selectors';
// eslint-disable-next-line nuclide-internal/no-cross-atom-imports
import {EVENT_HANDLER_SELECTOR} from '../../pkg/nuclide-file-tree/lib/FileTreeConstants';
// eslint-disable-next-line nuclide-internal/no-cross-atom-imports
import {WORKSPACE_VIEW_URI as FILE_TREE_VIEW_URI} from '../../pkg/nuclide-file-tree/lib/Constants';

import type {TestContext} from './remotable-tests';

export function runTest(context: TestContext) {
  it('sets a filter and then clears it when the sidebar or file tree toggles', () => {
    // $FlowIgnore: createPackage is magical
    const store = main.__getStore();

    let elem;
    waitsFor('DOM to load', 10000, () => {
      elem = document.querySelector(EVENT_HANDLER_SELECTOR);
      return elem != null;
    });

    const close = () => {
      runs(() => {
        atom.workspace.hide(FILE_TREE_VIEW_URI);
      });
      waits(1000); // Account for the closing notification delay.
    };
    const open = () => {
      runs(() => {
        atom.workspace.open(FILE_TREE_VIEW_URI, {searchAllPanes: true});
      });
      waits(100); // Open notifications are delayed by an animation frame.
    };

    // Open file tree
    open();

    runs(() => {
      invariant(elem != null);
      store.dispatch(Actions.clearFilter());
      atom.commands.dispatch(elem, 'tree-view:go-to-letter-a');
      expect(Selectors.getFilter(store.getState())).toEqual('a');
    });

    // Close and open file tree
    close();
    open();

    runs(() => {
      expect(Selectors.getFilter(store.getState())).toEqual('');
      invariant(elem != null);
      atom.commands.dispatch(elem, 'tree-view:go-to-letter-a');
      expect(Selectors.getFilter(store.getState())).toEqual('a');
    });
  });
}
