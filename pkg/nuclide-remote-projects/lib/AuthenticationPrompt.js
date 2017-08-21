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

import {CompositeDisposable} from 'atom';
import React from 'react';
import {getNotificationService} from './AtomNotifications';

type Props = {
  instructions: string,
  onConfirm: () => mixed,
  onCancel: () => mixed,
};

/** Component to prompt the user for authentication information. */
export default class AuthenticationPrompt extends React.Component<
  void,
  Props,
  void,
> {
  props: Props;

  _disposables: CompositeDisposable;

  constructor(props: Props) {
    super(props);
    this._disposables = new CompositeDisposable();
  }

  componentDidMount(): void {
    // Hitting enter when this panel has focus should confirm the dialog.
    this._disposables.add(
      atom.commands.add(this.refs.root, 'core:confirm', event =>
        this.props.onConfirm(),
      ),
    );

    // Hitting escape should cancel the dialog.
    this._disposables.add(
      atom.commands.add('atom-workspace', 'core:cancel', event =>
        this.props.onCancel(),
      ),
    );

    this.refs.password.focus();

    const raiseNativeNotification = getNotificationService();
    if (raiseNativeNotification != null) {
      const pendingNotification = raiseNativeNotification(
        'Nuclide Remote Connection',
        'Nuclide requires additional action to authenticate your remote connection',
        2000,
        false,
      );
      if (pendingNotification != null) {
        this._disposables.add(pendingNotification);
      }
    }
  }

  componentWillUnmount(): void {
    this._disposables.dispose();
  }

  focus(): void {
    this.refs.password.focus();
  }

  getPassword(): string {
    return this.refs.password.value;
  }

  _onKeyUp = (e: SyntheticKeyboardEvent): void => {
    if (e.key === 'Enter') {
      this.props.onConfirm();
    }

    if (e.key === 'Escape') {
      this.props.onCancel();
    }
  };

  render(): React.Element<any> {
    // * Need native-key-bindings so that delete works and we need `_onKeyUp` so that escape and
    //   enter work
    // * `instructions` are pre-formatted, so apply `whiteSpace: pre` to maintain formatting coming
    //   from the server.
    return (
      <div ref="root">
        <div className="block" style={{whiteSpace: 'pre'}}>
          {this.props.instructions}
        </div>
        <input
          tabIndex="0"
          type="password"
          className="nuclide-password native-key-bindings"
          ref="password"
          onKeyPress={this._onKeyUp}
        />
      </div>
    );
  }
}
