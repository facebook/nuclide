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

// DEPRECATED, AVOID USING THIS. Use 'showModal' in nuclide-commons-ui instead

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import * as React from 'react';
import ReactDOM from 'react-dom';
import {Observable} from 'rxjs';

type Props = {
  children?: any,
  modalClassName?: string,
  onDismiss: () => void,
};

/**
 * Shows a modal dialog when rendered, using Atom's APIs (atom.workspace.addModalPanel).
 */
export class Modal extends React.Component<Props> {
  _container: HTMLElement;
  _cancelDisposable: ?IDisposable;
  _innerElement: ?HTMLElement;
  _panel: atom$Panel;

  UNSAFE_componentWillMount(): void {
    this._container = document.createElement('div');
    this._panel = atom.workspace.addModalPanel({
      item: this._container,
      className: this.props.modalClassName,
    });
  }

  componentWillUnmount(): void {
    this._panel.destroy();
  }

  componentDidUpdate(prevProps: Props): void {
    const {modalClassName} = this.props;
    const {modalClassName: prevModalClassName} = prevProps;
    const panelElement = this._panel.getElement();
    if (prevModalClassName != null) {
      panelElement.classList.remove(
        ...prevModalClassName.split(/\s+/).filter(token => token.length > 0),
      );
    }
    if (modalClassName != null) {
      panelElement.classList.add(
        ...modalClassName.split(/\s+/).filter(token => token.length > 0),
      );
    }
  }

  _handleWindowClick = (event: SyntheticMouseEvent<>): void => {
    // If the user clicks outside of the modal, and not on a tooltip or
    // notification, close it.
    if (
      this._innerElement &&
      !this._innerElement.contains(((event.target: any): Node)) &&
      (event.target: any).closest('atom-notifications, .tooltip') == null
    ) {
      this.props.onDismiss();
    }
  };

  // Since we're rendering null, we can't use `findDOMNode(this)`.
  _handleContainerInnerElement = (el: ?HTMLElement): void => {
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
  };

  render() {
    const {modalClassName, children, onDismiss, ...props} = this.props;
    return ReactDOM.createPortal(
      <div tabIndex="0" {...props} ref={this._handleContainerInnerElement}>
        {this.props.children}
      </div>,
      this._container,
    );
  }
}
