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

import React from 'react';
import ReactDOM from 'react-dom';

type Props = {
  container: HTMLElement,

  // Must be a single React element. We do this (instead of wrapping in this component) to provide
  // maximum control to the owner.
  children?: any,
};

/**
 * Renders a single React element into a different part of the DOM. This allows you to maintain the
 * declarative nature of React components.
 */
export class Portal extends React.Component {
  props: Props;
  _container: HTMLElement;
  _renderedChildren: ?React.Element<any>;

  componentDidMount(): void {
    // Do the initial render.
    this._render(this.props.children, this.props.container);
  }

  componentWillUnmount(): void {
    this._render(null, this.props.container);
  }

  componentDidUpdate(): void {
    this._render(this.props.children, this.props.container);
  }

  _render(element: ?React.Element<any>, container: HTMLElement): void {
    if (
      this._container != null &&
      (container !== this._container || element == null)
    ) {
      ReactDOM.unmountComponentAtNode(this._container);
    }

    if (element != null) {
      ReactDOM.render(React.Children.only(element), container);
    }

    this._container = container;
    this._renderedChildren = element;
  }

  render() {
    // Don't actually render anything here.
    return null;
  }
}
