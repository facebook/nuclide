/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict
 * @format
 */

import classnames from 'classnames';
import * as React from 'react';

type Props = {
  onClick: () => mixed,
  visible: boolean,
};

export default class NewMessagesNotification extends React.Component<Props> {
  render(): React.Node {
    const className = classnames(
      'console-new-messages-notification',
      'badge',
      'badge-info',
      {
        visible: this.props.visible,
      },
    );
    return (
      <div className={className} onClick={this.props.onClick}>
        <span className="console-new-messages-notification-icon icon icon-nuclicon-arrow-down" />
        New Messages
      </div>
    );
  }
}
