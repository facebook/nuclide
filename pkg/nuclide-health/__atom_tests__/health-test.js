/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */
import nuclideUri from 'nuclide-commons/nuclideUri';
import invariant from 'assert';
import {WORKSPACE_VIEW_URI} from '../lib/HealthPaneItem';
import waitsFor from '../../../jest/waits_for';

const sleep = n => new Promise(r => setTimeout(r, n));

const openHealthPane = () => {
  // eslint-disable-next-line nuclide-internal/atom-apis
  atom.workspace.open(WORKSPACE_VIEW_URI, {searchAllPanes: true});
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

describe.skip('Health', () => {
  beforeEach(async () => {
    await atom.packages.activatePackage(nuclideUri.join(__dirname, '..'));
  });

  it('contains stats after its first refresh', async () => {
    let pane;
    let item;
    openHealthPane();
    await sleep(2000);
    await waitsFor(() => {
      const {pane: pane_, item: item_} = findHealthPaneAndItem();
      pane = pane_;
      item = item_;
      return item != null && pane != null;
    });
    invariant(item != null);
    expect(item.getTitle()).toEqual('Health');
    const element = atom.views.getView(item);
    await waitsFor(() => element.innerHTML.trim() !== '');
    expect(element.innerHTML).toContain('Stats');
    expect(element.innerHTML).toContain('CPU');
    expect(element.innerHTML).toContain('Heap');
    expect(element.innerHTML).toContain('Memory');
    expect(element.innerHTML).toContain('Handles');
    expect(element.innerHTML).toContain('Event loop');
  });

  it('disappears when closed', async () => {
    openHealthPane();
    let pane;
    let item;
    await waitsFor(() => {
      const {pane: pane_, item: item_} = findHealthPaneAndItem();
      pane = pane_;
      item = item_;
      return item != null && pane != null;
    });
    invariant(pane != null);
    invariant(item != null);
    pane.activateItem(item);
    atom.commands.dispatch(atom.views.getView(atom.workspace), 'core:close');
    await sleep(500);
    // Explicitly cast the result to boolean rather than using `.toBeFalsy()`
    // since Jasmine crashes when trying to pretty print the item.
    expect(Boolean(findHealthPaneAndItem().item)).toBe(false);
  });
});
