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

import nuclideUri from 'nuclide-commons/nuclideUri';
import invariant from 'assert';
import {WORKSPACE_VIEW_URI} from '../lib/HealthPaneItem';

const openHealthPane = () => {
  // eslint-disable-next-line nuclide-internal/atom-apis
  atom.workspace.open(WORKSPACE_VIEW_URI);
};

function findHealthPaneAndItem(): {pane: ?atom$Pane, item: ?Object} {
  for (const pane of atom.workspace.getPanes()) {
    for (const item of pane.getItems()) {
      if (item.getTitle() === 'Health') {
        return {pane, item};
      }
    }
  }
  return {pane: null, item: null};
}

describe('Health', () => {
  beforeEach(() => {
    waitsForPromise(
      {label: 'workspace views to load', timeout: 10000},
      async () => {
        jasmine.unspy(window, 'setTimeout');
        await Promise.all([
          atom.packages.activatePackage(nuclideUri.join(__dirname, '..')),
        ]);
      },
    );
  });

  it('contains stats after its first refresh', () => {
    let element;
    let pane;
    let item;
    runs(() => {
      openHealthPane();
      waits(2000);
    });
    waitsFor(() => {
      const {pane: pane_, item: item_} = findHealthPaneAndItem();
      pane = pane_;
      item = item_;
      return item != null && pane != null;
    }, 500);
    runs(() => {
      invariant(item != null);
      expect(item.getTitle()).toEqual('Health');
      element = atom.views.getView(item);
    });
    waitsFor(() => element.innerHTML.trim() !== '', 500);
    runs(() => {
      expect(element.innerHTML).toContain('Stats');
      expect(element.innerHTML).toContain('CPU');
      expect(element.innerHTML).toContain('Heap');
      expect(element.innerHTML).toContain('Memory');
      expect(element.innerHTML).toContain('Handles');
      expect(element.innerHTML).toContain('Event loop');
    });
  });

  it('disappears when closed', () => {
    runs(() => {
      openHealthPane();
    });
    let pane;
    let item;
    waitsFor(() => {
      const {pane: pane_, item: item_} = findHealthPaneAndItem();
      pane = pane_;
      item = item_;
      return item != null && pane != null;
    }, 500);
    runs(() => {
      invariant(pane != null);
      invariant(item != null);
      pane.activateItem(item);
      atom.commands.dispatch(atom.views.getView(atom.workspace), 'core:close');
      waits(500);
      expect(findHealthPaneAndItem().item).toBeFalsy();
    });
  });
});
