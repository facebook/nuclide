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
import {Notice} from './TextEditorBanner';
import {Button, ButtonTypes} from './Button';
import {MessageTypes} from './Message';

type Props = {
  detailedMessage: string,
  canEditAnyway?: boolean,
  onEditAnyway?: () => void,
  onDismiss?: () => void,
};

export default class ReadOnlyNotice extends React.Component<Props> {
  render(): React.Node {
    let editAnywayButton;

    if (this.props.canEditAnyway) {
      editAnywayButton = (
        <Button buttonType={ButtonTypes.INFO} onClick={this.props.onEditAnyway}>
          Edit Anyway
        </Button>
      );
    }

    const dismissButton = (
      <Button buttonType={ButtonTypes.INFO} onClick={this.props.onDismiss}>
        Dismiss
      </Button>
    );

    return (
      <Notice messageType={MessageTypes.info}>
        <span>
          <strong>This is a read-only file.</strong>
          <br />
          {this.props.detailedMessage}
        </span>
        <div>
          {editAnywayButton}
          {dismissButton}
        </div>
      </Notice>
    );
  }
}
