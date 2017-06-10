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

import {
  dispatchKeyboardEvent,
  waitsForFilePosition,
} from '../../pkg/commons-atom/testHelpers';

// Checks that a hyperclick event in the current editor at the given position causes a navigation to
// the given end file and position. For use within Jasmine.
export function waitsForHyperclickResult(
  startPosition: [number, number],
  endFile: string,
  endPosition: [number, number],
): void {
  runs(() => {
    const currentEditor = atom.workspace.getActiveTextEditor();
    invariant(currentEditor != null);
    currentEditor.setCursorBufferPosition(startPosition);
    // shortcut key for hyperclick:confirm-cursor
    dispatchKeyboardEvent('enter', document.activeElement, {
      cmd: true,
      alt: true,
    });
  });

  waitsForFilePosition(endFile, ...endPosition);
}

export function waitsForMultipleHyperclickResults(
  startPosition: [number, number],
  expectedResultsText: Array<string>,
) {
  runs(() => {
    dispatchKeyboardEvent('enter', document.activeElement, {
      cmd: true,
      alt: true,
    });
  });

  let results;
  waitsFor(() => {
    // Convert from a NodeList to an actual array.
    results = Array.from(
      atom.views
        .getView(atom.workspace)
        .querySelectorAll('.hyperclick-result-item'),
    );
    return results.length > 0;
  });

  runs(() => {
    const resultsText = results.map(result => result.innerText);
    expect(resultsText).toEqual(expectedResultsText);
  });
}
