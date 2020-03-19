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

import addTooltip from 'nuclide-commons-ui/addTooltip';
import {collect, someOfIterable} from 'nuclide-commons/collection';
import nullthrows from 'nullthrows';
import * as React from 'react';
import ConnectionState from './ConnectionState';

export type Props = {
  // Map of hostname to connection states.
  connectionStates: Map<string, $Values<typeof ConnectionState>>,
};

export default class StatusBarTile extends React.Component<Props> {
  render(): React.Node {
    const {connectionStates} = this.props;
    if (connectionStates.size === 0) {
      return null;
    }
    const isDisconnected = someOfIterable(
      connectionStates.values(),
      x => x === ConnectionState.DISCONNECTED,
    );
    const iconName: atom$Octicon = isDisconnected ? 'alert' : 'cloud-upload';
    return (
      <span
        className={`icon icon-${iconName} nuclide-remote-projects-status-icon`}
        onClick={this._onStatusBarTileClicked}
        // eslint-disable-next-line nuclide-internal/jsx-simple-callback-refs
        ref={addTooltip({title: 'Click for connection details.'})}
      />
    );
  }

  _onStatusBarTileClicked = (): void => {
    const {connectionStates} = this.props;
    if (connectionStates.size === 0) {
      return;
    }
    const grouped = collect(
      Array.from(connectionStates).map(([hostname, state]) => [
        state,
        hostname,
      ]),
    );
    const disconnectedHosts = grouped.get(ConnectionState.DISCONNECTED);
    if (disconnectedHosts != null) {
      atom.notifications.addWarning(
        `Lost connection to ${disconnectedHosts.join(
          ', ',
        )}. Attempting to reconnect...`,
      );
    } else {
      const connectedHosts = nullthrows(grouped.get(ConnectionState.CONNECTED));
      atom.notifications.addInfo(`Connected to ${connectedHosts.join(', ')}.`);
    }
  };
}
