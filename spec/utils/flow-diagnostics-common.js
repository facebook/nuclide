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

      dispatchKeyboardEvent('s', document.activeElement, {cmd: true});
    });

    waitsForGutterDiagnostics();

    runs(() => {
      // This may need to be updated if Flow changes error text
      const expectedGutterText = 'property `baz`\nProperty not found in\nFoo';
      expectGutterDiagnosticToContain(expectedGutterText);

      // The text is rendered slightly differently in the gutter and the panel
      const expectedPanelText = 'property `baz` Property not found in Foo';

      const [diagnosticRowElement] = getPanelDiagnosticElements();
      const diagnosticDescriptionElements = diagnosticRowElement.querySelectorAll(
        '.nuclide-ui-table-row:last-child .nuclide-ui-table-body-cell:last-child',
      );
      expect(diagnosticDescriptionElements.length).toBe(1);
      const diagnosticElement = diagnosticDescriptionElements[0];
      expect(diagnosticElement.innerText).toContain(expectedPanelText);

      textEditor.setCursorBufferPosition([0, 0]);
      diagnosticElement.click();
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
      dispatchKeyboardEvent('s', document.activeElement, {cmd: true});
    });

    waitsFor(() => {
      const [panelElement] = getPanelDiagnosticElements();
      return panelElement.innerHTML.indexOf('No diagnostic messages') !== -1;
    });
  });
}
