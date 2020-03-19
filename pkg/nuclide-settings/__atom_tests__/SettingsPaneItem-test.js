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
import invariant from 'assert';
import nullthrows from 'nullthrows';
import openSettingsView from '../lib/openSettingsView';
import {WORKSPACE_VIEW_URI} from '../lib/SettingsPaneItem';

// TODO: T30807047 make it an e2e test
describe.skip('SettingsPaneItem', () => {
  beforeEach(() => {
    nullthrows(document.body).appendChild(atom.views.getView(atom.workspace));
    atom.workspace.addOpener(openSettingsView);
  });

  it('sets focus to the filter input after the pane is opened', async () => {
    await atom.workspace.open(WORKSPACE_VIEW_URI);
    const settingsViewEl = document.querySelector('.settings-view');
    invariant(settingsViewEl != null);

    expect(settingsViewEl.contains(document.activeElement)).toBe(true);
  });
});
