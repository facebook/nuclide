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
import {Portal} from './Portal';
import React from 'react';
import {Observable} from 'rxjs';

type Props = {
  children?: any,
  onDismiss: () => void,
};

/**
 * Shows a modal dialog when rendered, using Atom's APIs (atom.workspace.addModalPanel).
 */
export class Modal extends React.Component {
  props: Props;
  _container: HTMLElement;
  _cancelDisposable: ?IDisposable;
  _innerElement: ?HTMLElement;
  _panel: atom$Panel;

  constructor(props: Props) {
    super(props);
    (this: any)._handleContainerInnerElement = this._handleContainerInnerElement.bind(
      this,
    );
    (this: any)._handleWindowClick = this._handleWindowClick.bind(this);
  }

  componentWillMount(): void {
    this._container = document.createElement('div');
    this._panel = atom.workspace.addModalPanel({item: this._container});
  }

  componentWillUnmount(): void {
    this._panel.destroy();
  }

  _handleWindowClick(event: SyntheticMouseEvent): void {
    // If the user clicks outside of the modal, close it.
    if (
      this._innerElement &&
      !this._innerElement.contains(((event.target: any): Node))
    ) {
      this.props.onDismiss();
    }
  }

  // Since we're rendering null, we can't use `findDOMNode(this)`.
  _handleContainerInnerElement(el: ?HTMLElement): void {
    if (this._cancelDisposable != null) {
      this._cancelDisposable.dispose();
    }

    this._innerElement = el;
    if (el == null) {
      return;
    }

    el.focus();
    this._cancelDisposable = new UniversalDisposable(
      atom.commands.add(window, 'core:cancel', () => {
        this.props.onDismiss();
      }),
      Observable.fromEvent(window, 'mousedown')
        // Ignore clicks in the current tick. We don't want to capture the click that showed this
        // modal.
        .skipUntil(Observable.interval(0).first())
        .subscribe(this._handleWindowClick),
    );
  }

  render() {
    const props = {...this.props};
    delete props.onDismiss;
    return (
      <Portal container={this._container}>
        <div tabIndex="0" {...props} ref={this._handleContainerInnerElement}>
          {this.props.children}
        </div>
      </Portal>
    );
  }
}
