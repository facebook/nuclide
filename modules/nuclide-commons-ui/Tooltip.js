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
import ReactDOM from 'react-dom';

type DefaultProps = {|
  delay: number,
|};

type Props = {|
  title: string,
  delay?: number,
  children: React.Node,
|};

type RefWrapperProps = {|
  customRef: (element: null | Element | Text) => void,
  children: React.Node,
|};

// Our custom ref component invokes a callback after updating
// if the child component has changed. We need a custom ref component
// because stateless functional components can't have refs
class RefWrapper extends React.Component<RefWrapperProps> {
  _el = null;

  componentDidMount(): void {
    this._updateElement();
  }

  componentWillUnmount(): void {
    if (this._el != null) {
      this._el = null;
      this.props.customRef(null);
    }
  }

  _updateElement(): void {
    const el = ReactDOM.findDOMNode(this);
    if (el !== this._el) {
      this._el = el;
      this.props.customRef(null);
      this.props.customRef(el);
    }
  }

  componentDidUpdate(prevProps: RefWrapperProps): void {
    if (this.props.children !== prevProps.children) {
      this._updateElement();
    }
  }

  render(): React.Node {
    return React.Children.only(this.props.children);
  }
}

export class Tooltip extends React.Component<Props> {
  _tooltip: IDisposable;
  _element: null | Text | Element;

  constructor(props: Props) {
    super(props);

    this._element = null;
  }

  static defaultProps: DefaultProps = {
    delay: 0,
  };

  componentDidUpdate(prevProps: Props) {
    if (this._element != null && this.props.title !== prevProps.title) {
      this._displayTooltip(this._element);
    }
  }

  _displayTooltip = (element: null | Element | Text): void => {
    if (this._tooltip != null) {
      this._tooltip.dispose();
    }

    if (element != null) {
      this._element = element;
      // $FlowFixMe - HTMLElement is incompatible with Element
      this._tooltip = atom.tooltips.add(element, {
        title: this.props.title || '',
        delay: this.props.delay,
      });
    }
  };

  render(): React.Node {
    return (
      <RefWrapper customRef={this._displayTooltip}>
        {this.props.children}
      </RefWrapper>
    );
  }
}
