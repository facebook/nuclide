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

import ConnectionState from './ConnectionState';
import {
  notifyLocalDiskFile,
  notifyConnectedRemoteFile,
  notifyDisconnectedRemoteFile,
} from './notification';
import React from 'react';

type Props = {
  connectionState: number,
  fileUri?: string,
};

export default class StatusBarTile extends React.Component {
  props: Props;

  render(): ?React.Element<any> {
    let iconName = null;
    switch (this.props.connectionState) {
      case ConnectionState.NONE:
        break;
      case ConnectionState.CONNECTED:
        iconName = 'cloud-upload';
        break;
      case ConnectionState.DISCONNECTED:
        iconName = 'alert';
        break;
    }
    // When the active pane isn't a text editor, e.g. diff view, preferences, ..etc.,
    // We don't show a connection status bar.
    if (!iconName) {
      return null;
    }
    return (
      <span
        className={`icon icon-${iconName} nuclide-remote-projects-status-icon`}
        onClick={this._onStatusBarTileClicked}
      />
    );
  }

  _onStatusBarTileClicked = (): void => {
    // flowlint-next-line sketchy-null-string:off
    if (!this.props.fileUri) {
      return;
    }
    switch (this.props.connectionState) {
      case ConnectionState.LOCAL:
        notifyLocalDiskFile(this.props.fileUri);
        break;
      case ConnectionState.CONNECTED:
        notifyConnectedRemoteFile(this.props.fileUri);
        break;
      case ConnectionState.DISCONNECTED:
        notifyDisconnectedRemoteFile(this.props.fileUri);
        break;
    }
  };
}
