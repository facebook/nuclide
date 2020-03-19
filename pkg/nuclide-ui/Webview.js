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

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import * as React from 'react';
import ReactDOM from 'react-dom';

// These props are all turned into attributes in `updateAttributes`
/* eslint-disable react/no-unused-prop-types */
type Props = {|
  className: ?string,
  nodeintegration?: boolean,
  onDidFinishLoad: (event: Event) => mixed,
  src: string,
  style: ?Object,
  useragent?: string,
|};
/* eslint-enable react/no-unused-prop-types */

export class Webview extends React.Component<Props, void> {
  props: Props;

  _disposables: UniversalDisposable;

  constructor(props: Object) {
    super(props);
    this._disposables = new UniversalDisposable();
  }

  componentDidMount() {
    const element = ReactDOM.findDOMNode(this);

    // Add event listeners. This has the drawbacks of 1) adding an event listener even when we don't
    // have a callback for it and 2) needing to add explicit support for each event type we want to
    // support. However, those costs aren't great enough to justify a new abstraction for managing
    // it at this time.
    // $FlowFixMe
    element.addEventListener('did-finish-load', this._handleDidFinishLoad);
    this._disposables.add(
      new UniversalDisposable(() =>
        // $FlowFixMe
        element.removeEventListener(
          'did-finish-load',
          this._handleDidFinishLoad,
        ),
      ),
    );

    this.updateAttributes({});
  }

  componentDidUpdate(prevProps: Props): void {
    this.updateAttributes(prevProps);
  }

  componentWillUnmount() {
    this._disposables.dispose();
  }

  render(): React.Node {
    return (
      <webview className={this.props.className} style={this.props.style} />
    );
  }

  /**
   * Update the attributes on the current element. Custom attributes won't be added by React because
   * "webview" isn't a valid custom element name (custom elements need a dash), so we set the
   * attributes ourselves. But not "className" or "style" because React has special rules for those.
   * *sigh*
   */
  updateAttributes(prevProps: Object): void {
    const element = ReactDOM.findDOMNode(this);
    const specialProps = ['className', 'style', 'onDidFinishLoad'];
    const normalProps = Object.keys(this.props).filter(
      prop => specialProps.indexOf(prop) === -1,
    );
    normalProps.forEach(prop => {
      const value = this.props[prop];
      const prevValue = prevProps[prop];
      const valueChanged = value !== prevValue;
      if (valueChanged) {
        // $FlowFixMe
        element[prop] = value;
      }
    });
  }

  _handleDidFinishLoad = (event: Event): void => {
    if (this.props.onDidFinishLoad) {
      this.props.onDidFinishLoad(event);
    }
  };
}
