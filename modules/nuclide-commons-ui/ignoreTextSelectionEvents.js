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

/* global getSelection */

/**
 * Atom by default disables text selection by default on all the non editor
 * views. In order to enable it, in a container you need to add the props
 *   className="native-key-bindings"
 *   tabIndex={-1}
 * and add the style
 *   -webkit-user-select: initial;
 *
 * The downside of this approach is that by default, the onClick events
 * are going to be triggered when you try to select text.
 * This is where this module comes in, it will prevent the callback from
 * being triggered in a text selection event.
 *
 * To use it, just wrap your callback in a ignoreTextSelectionEvents call
 *   onClick={ignoreTextSelectionEvents(this._onClick)}
 */

const ignoreTextSelectionEvents = (
  cb?: (e: SyntheticMouseEvent<>) => mixed,
) => {
  return (e: SyntheticMouseEvent<>) => {
    // Ignore text selection
    const selection = getSelection();
    if (selection != null && selection.type === 'Range') {
      e.preventDefault();
      return;
    }

    cb && cb(e);
  };
};

export default ignoreTextSelectionEvents;
