/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import React from 'react';
import invariant from 'assert';
import tabbable from 'tabbable';
import classnames from 'classnames';

type DefaultProps = {
  contained: boolean,
};

type Props = {
  children?: React$Element<any>,
  contained: boolean,
  className?: string,
};

// NOTE: This constant must be kept in sync with the keybinding in
//       ../nuclide-tab-focus/keymaps/nuclide-tab-focus.json
export const _TABBABLE_CLASS_NAME = 'nuclide-tabbable';

/**
 * Enables focusing between inputs with tab and shift-tab. Can also be used to
 * trap focus within the container by using the contained property.
 */
export default class TabbableContainer extends React.Component<Props> {
  _rootNode: ?HTMLDivElement;

  static defaultProps: DefaultProps = {
    contained: false,
    autoFocus: false,
  };

  componentDidMount() {
    const rootNode = this._rootNode;
    invariant(rootNode != null);

    // If focus has been deliberately set inside the container, don't try
    // to override it
    if (!rootNode.contains(document.activeElement)) {
      const tabbableElements = tabbable(rootNode);
      const firstTabbableElement = tabbableElements[0];
      if (firstTabbableElement != null) {
        firstTabbableElement.focus();
      }
    }
  }

  render(): React$Node {
    return (
      <div
        className={classnames(_TABBABLE_CLASS_NAME, this.props.className)}
        data-contained={this.props.contained}
        ref={node => (this._rootNode = node)}>
        {this.props.children}
      </div>
    );
  }
}
