/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

/* global MutationObserver */

// We need a negative tabIndex to mark 'atom-text-editor' as focusable (as focus
// gets forwarded to the underlying input) yet not in the tabOrder so that
// shift-tabbing when the input is focused won't try to focus its own 'atom-text-editor'
// and appear to do nothing.  We can't use '-1' as we want to forward that to
// the underlying input if it is set on atom-text-editor
const FAKE_TAB_INDEX = '-2';

export default function(element: HTMLElement): IDisposable {
  const observer = new MutationObserver(() => {
    const tabIndex = element.getAttribute('tabindex');
    if (tabIndex == null || tabIndex === FAKE_TAB_INDEX) {
      return;
    }
    const input = element.querySelector('input');
    if (input == null) {
      return;
    }
    input.setAttribute('tabindex', tabIndex);
    element.setAttribute('tabindex', FAKE_TAB_INDEX);
  });

  observer.observe(element, {
    attributes: true,
    attributeFilter: ['tabindex'],
  });

  return {
    dispose(): void {
      observer.disconnect();
    },
  };
}
