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

/* global MouseEvent */

import invariant from 'assert';

export function doGutterDiagnosticsExist(): boolean {
  return getGutterElement() != null;
}

export function waitsForGutterDiagnostics(): void {
  waitsFor('error to appear', 10000, () => {
    return getGutterElement() != null;
  });
}

export function expectGutterDiagnosticToContain(message: string): void {
  const gutterElement = getGutterElement();
  invariant(gutterElement != null);
  gutterElement.dispatchEvent(new MouseEvent('mouseenter'));

  const popupElement = getPopupElement();
  invariant(popupElement != null);

  expect(popupElement.innerText).toContain(message);
}

export function isDiagnosticsPanelShowing(): boolean {
  let node = getDiagnosticsPanelElement();
  if (node == null) {
    return false;
  }
  while (node != null) {
    if (node.clientHeight === 0 || node.clientWidth === 0) {
      return false;
    }
    node = ((node.parentElement: any): HTMLElement);
  }
  return true;
}

export function waitsForStatusBarItem(): void {
  waitsFor('gutter icon to load in the DOM', 10000, () => {
    const element = getStatusBarElement();
    return element != null && element.children.length !== 0;
  });
}

export function clickStatusBarItem(): void {
  const element = getStatusBarElement();
  invariant(element != null);
  element.click();
}

function getGutterElement(): ?HTMLElement {
  return atom.views
    .getView(atom.workspace)
    .querySelector('atom-workspace .diagnostics-gutter-ui-gutter-error');
}

function getPopupElement(): ?HTMLElement {
  return document.querySelector('.diagnostics-popup');
}

// Returns the parent element of .diagnostics-ui, which is helpful for determining
// whether the diagnostics panel is shown or hidden
function getDiagnosticsPanelElement(): ?HTMLElement {
  const rootNode = atom.views
    .getView(atom.workspace)
    .querySelector('.diagnostics-ui');
  return rootNode == null
    ? null
    : ((rootNode.parentElement: any): ?HTMLElement);
}

function getStatusBarElement(): ?HTMLElement {
  return atom.views
    .getView(atom.workspace)
    .querySelector('.diagnostics-status-bar-highlight');
}

export function getPanelDiagnosticElements(): Array<HTMLElement> {
  const panelElement = getDiagnosticsPanelElement();
  invariant(panelElement != null);
  return Array.from(
    panelElement.querySelectorAll(
      '.diagnostics-ui-table-container .nuclide-ui-table-body',
    ),
  );
}
