/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict
 * @format
 */

import invariant from 'assert';

// Attach the Atom workspace to the DOM, and give it a reasonable size.
// This is important for tests that touch the text editor in 1.19+, as they'll have a height of 0
// unless properly attached with a valid viewport.
// NOTE: for Jest tests use `attachWorkspace()` function from this file
export function jasmineAttachWorkspace(): void {
  jasmine.attachToDOM(atom.views.getView(atom.workspace));

  // Set the testing window dimensions (smallish, yet realistic).
  const styleCSS = `
    height: 600px;
    width: 1000px;
  `;
  const content = document.querySelector('#jasmine-content');
  invariant(content != null);
  content.setAttribute('style', styleCSS);

  // Unset the 'top' attribute of the spec reporter to make the full window visible.
  // This is purely for developer convenience when running specs in a visible window.
  const specReporter = document.querySelector('.spec-reporter-container');
  if (specReporter != null) {
    specReporter.setAttribute('style', 'top: inherit');
  }
}

export function attachWorkspace(): void {
  const container = document.createElement('div');
  container.id = 'test-container';
  invariant(document.body);
  document.body.appendChild(container);
  container.appendChild(atom.views.getView(atom.workspace));

  // Set the testing window dimensions (smallish, yet realistic).
  const styleCSS = `
    height: 600px;
    width: 1000px;
  `;
  const content = document.querySelector('#test-container');
  invariant(content != null);
  content.setAttribute('style', styleCSS);

  // Unset the 'top' attribute of the spec reporter to make the full window visible.
  // This is purely for developer convenience when running specs in a visible window.
  const specReporter = document.querySelector('.spec-reporter-container');
  if (specReporter != null) {
    specReporter.setAttribute('style', 'top: inherit');
  }
}
