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

import * as React from 'react';
import {findDOMNode} from 'react-dom';

type Props = {
  onClickOutside: ?() => mixed,
  children: ?React.Element<any>,
};

export default class ClickOutsideBoundary extends React.Component<Props> {
  _lastInternalEvent: ?MouseEvent;
  _node: null | Element | Text;

  constructor(props: Props) {
    super(props);
    this._lastInternalEvent = null;
    this._node = null;
  }

  componentDidMount() {
    const node = (this._node = findDOMNode(this));
    if (node == null) {
      return;
    }
    window.document.addEventListener('click', this._handleDocumentClick);
    // We use an actual DOM node (via refs) because React does not gaurnetee
    // any particular event ordering between synthentic events and native
    // events, and we require that the internal event fire before the global event.
    // https://discuss.reactjs.org/t/ordering-of-native-and-react-events/829/2
    node.addEventListener('click', this._handleInternalClick);
  }

  _handleDocumentClick = (e: MouseEvent) => {
    // A more straight-forward approach would be to use
    // `this._node.contains(e.target)`, however that fails in the edge case were
    // some other event handler causes the target to be removed from the DOM
    // before the event reaches the document root. So instead, we use this
    // reference comparison approach which works for all cases where an event
    // passed trough the boundary node, and makes it all the way to the document
    // root.
    if (e !== this._lastInternalEvent) {
      if (this.props.onClickOutside != null) {
        this.props.onClickOutside();
      }
    }
    this._lastInternalEvent = null;
  };

  _handleInternalClick = (e: MouseEvent) => {
    this._lastInternalEvent = e;
  };

  componentWillUnmount() {
    window.document.removeEventListener('click', this._handleDocumentClick);
    if (this._node != null) {
      this._node.removeEventListener('click', this._handleInternalClick);
    }
  }

  render() {
    const {onClickOutside, ...passThroughProps} = this.props;
    return <div {...passThroughProps} />;
  }
}
