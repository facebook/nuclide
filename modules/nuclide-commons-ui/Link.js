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

/* eslint-env browser */

import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import * as React from 'react';
import nullthrows from 'nullthrows';

/**
 * A more accessible abstraction over `<a>`s in Atom, where the default behavior
 * prevents pressing Enter/Return from opening a link. In Atom, the `native-key-bindings`
 * on `<a>`s addresses this, but prevents tabbing to/from these elements.
 *
 * Instead, listen for 'atom:core-confirm' (which by default occurs on Enter/Return)
 * and dispatch a simulated click MouseEvent when these happen. This is not unlike
 * typical browser behavior when Enter/Return is pressed on links, triggering their
 * 'click' event with a simulated MouseEvent.
 */
export default class Link extends React.Component<{}> {
  _disposable: ?UniversalDisposable;
  _node: ?HTMLAnchorElement;

  componentDidMount() {
    this._disposable = new UniversalDisposable(
      observableFromSubscribeFunction(cb =>
        atom.commands.add(nullthrows(this._node), 'core:confirm', cb),
      ).subscribe(() => {
        if (this._node == null) {
          return;
        }

        this._node.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
          }),
        );
      }),
    );
  }

  componentWillUnmount() {
    if (this._disposable != null) {
      this._disposable.dispose();
    }
  }

  _updateNode = (node: ?HTMLAnchorElement) => {
    this._node = node;
  };

  render() {
    return <a {...this.props} ref={this._updateNode} />;
  }
}
