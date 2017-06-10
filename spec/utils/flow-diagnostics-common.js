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

import type {TestContext} from './remotable-tests';

import {Range} from 'atom';

import {dispatchKeyboardEvent} from '../../pkg/commons-atom/testHelpers';

import {
  doGutterDiagnosticsExist,
  waitsForGutterDiagnostics,
  expectGutterDiagnosticToContain,
  waitsForStatusBarItem,
  clickStatusBarItem,
  isDiagnosticsPanelShowing,
  getPanelDiagnosticElements,
} from './diagnostics-common';

import {setup} from './flow-common';

export function runTest(context: TestContext) {
  it('tests for flow ', () => {
    const textEditorPromise = setup(context);
    let textEditor: atom$TextEditor;

    waitsForStatusBarItem();
    runs(() => {
      clickStatusBarItem();
    });
    waitsFor(() => isDiagnosticsPanelShowing());
    waitsForPromise(async () => {
      textEditor = await textEditorPromise;
      // Change `bar` to `baz`
      textEditor.setTextInBufferRange(new Range([3, 12], [3, 13]), 'z');

      expect(doGutterDiagnosticsExist()).toBeFalsy();

      save();
    });

    waitsForGutterDiagnostics();

    runs(() => {
      // This may need to be updated if Flow changes error text
      const expectedGutterText = 'property `baz`\nProperty not found in\nFoo';
      expectGutterDiagnosticToContain(expectedGutterText);
    });

    // The text is rendered slightly differently in the gutter and the panel
    const expectedPanelText = 'property `baz` Property not found in Foo';
    let diagnosticDescriptionElements;

    waitsFor(() => {
      const [diagnosticRowElement] = getPanelDiagnosticElements();
      diagnosticDescriptionElements = diagnosticRowElement.querySelectorAll(
        '.nuclide-ui-table-row:last-child .nuclide-ui-table-body-cell:last-child',
      );
      return (
        diagnosticDescriptionElements.length === 1 &&
        diagnosticDescriptionElements[0].innerText &&
        diagnosticDescriptionElements[0].innerText.includes(expectedPanelText)
      );
    }, 'Diagnostic renders correct text');

    runs(() => {
      textEditor.setCursorBufferPosition([0, 0]);
      if (
        diagnosticDescriptionElements &&
        diagnosticDescriptionElements.length > 0
      ) {
        diagnosticDescriptionElements[0].click();
      }
    });

    waitsFor(() => {
      return textEditor.getCursorBufferPosition().isEqual([3, 0]);
    });

    runs(() => {
      // We've had an issue where the diagnostics panel stops getting updated after it's been
      // toggled off and on again. Guard against that.
      clickStatusBarItem();
    });
    waitsFor(() => !isDiagnosticsPanelShowing());
    runs(() => {
      clickStatusBarItem();
    });
    waitsFor(() => isDiagnosticsPanelShowing());
    runs(() => {
      // Change `baz` back to `bar`
      textEditor.setTextInBufferRange(new Range([3, 12], [3, 13]), 'r');
      save();
    });

    waitsFor(() => {
      const [panelElement] = getPanelDiagnosticElements();
      return panelElement.innerHTML.indexOf('No diagnostic messages') !== -1;
    });
  });
}

function save(): void {
  // In Atom 1.17, using cmd + S while a dock item is focused will atempt to save that dock item.
  // (This behavior was changed in 1.18.) To make sure we're compatible with that version, forcibly
  // activate the workspace center. This `activate()` call can be removed after we upgrade to 1.18.
  const center = atom.workspace.getCenter ? atom.workspace.getCenter() : null;
  if (center != null) {
    center.activate();
  }
  dispatchKeyboardEvent('s', document.activeElement, {cmd: true});
}
