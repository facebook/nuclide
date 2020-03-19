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

import {
  activateAllPackages,
  jasmineIntegrationTestSetup,
  deactivateAllPackages,
} from './utils/integration-test-helpers';
import {
  isDiagnosticsPanelShowing,
  clickStatusBarItem,
  waitsForStatusBarItem,
} from './utils/diagnostics-common';
import {dispatchKeyboardEvent} from '../pkg/commons-atom/testHelpers';

describe('Diagnostics panel integration test', () => {
  // This test asserts that the gutter icon for the diagnostics panel is loaded when
  // atom starts, and then checks that the diagnostics panel both loads and hides when
  //    (a) the gutter icon is clicked
  //    (b) the keyboard shortcut is pressed
  it('shows the gutter icon when package activated, \
  and shows UI when icon or keyboard shortcut pressed', () => {
    waitsForPromise(async () => {
      // Configure some jasmine specific things for integration testing.
      jasmineIntegrationTestSetup();
      // Activate nuclide packages.
      await activateAllPackages();
    });

    waitsForStatusBarItem();

    runs(() => {
      // Try showing the diagnostics UI by clicking the button
      clickStatusBarItem();
    });

    waitsFor('diagnostics panel to load in the DOM', 10000, () => {
      // Did the diagnostics panel appear?
      return isDiagnosticsPanelShowing();
    });

    runs(() => {
      // Click gutter icon again to hide it
      clickStatusBarItem();
    });

    waitsFor('diagnostics panel to be hidden', 10000, () => {
      // Did the diagnostics panel hide?
      return !isDiagnosticsPanelShowing();
    });

    runs(() => {
      // Now show the panel with the keyboard shortcut
      dispatchKeyboardEvent('D', document.activeElement, {
        alt: true,
        shift: true,
      });
    });

    waitsFor('diagnostics panel to be shown', 10000, () => {
      // Did the diagnostics panel appear?
      return isDiagnosticsPanelShowing();
    });

    runs(() => {
      // Now hide the panel with the keyboard shortcut
      dispatchKeyboardEvent('D', document.activeElement, {
        alt: true,
        shift: true,
      });
    });

    waitsFor('diagnostics panel to be hidden', 10000, () => {
      // Did the diagnostics panel hide?
      return !isDiagnosticsPanelShowing();
    });

    // Deactivate nuclide packages.
    waitsForPromise(deactivateAllPackages);
  });
});
