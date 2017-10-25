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

/* globals Element */

import type {RemoteConnection} from '../../nuclide-remote-connection';
import type {NuclideRemoteConnectionProfile} from './connection-types';
import type {
  NuclideNewConnectionProfileInitialFields,
  NuclideRemoteConnectionParams,
} from './connection-types';
import type {SshConnectionConfiguration} from '../../nuclide-remote-connection/lib/SshHandshake';

import {getUniqueHostsForProfiles} from './connection-profile-utils';
import ConnectionDialog from './ConnectionDialog';
import CreateConnectionProfileForm from './CreateConnectionProfileForm';
import * as React from 'react';
import ReactDOM from 'react-dom';

type Screen = 'connect' | 'create-connection';

export type Props = {
  connectionProfiles: Array<NuclideRemoteConnectionProfile>,
  initialFormFields:
    | NuclideNewConnectionProfileInitialFields
    | NuclideRemoteConnectionParams,
  selectedProfileIndex: number,
  screen: Screen,
  onScreenChange: (screen: Screen) => mixed,

  onCancel: () => mixed,
  onClosed?: () => mixed,
  onConnect: (
    connection: RemoteConnection,
    config: SshConnectionConfiguration,
  ) => mixed,
  onError: (error: Error, config: SshConnectionConfiguration) => mixed,
  onDeleteProfileClicked: (selectedProfileIndex: number) => mixed,
  onSaveProfile: (
    index: number,
    profile: NuclideRemoteConnectionProfile,
  ) => void,
  onProfileSelected: (selectedProfileIndex: number) => void,

  onProfileCreated: (profile: NuclideRemoteConnectionProfile) => mixed,
};

export default class RemoteProjectConnectionModal extends React.Component<
  Props,
> {
  componentDidMount(): void {
    this._updatePanelClass();
  }

  componentDidUpdate(prevProps: Props): void {
    if (this.props.screen !== prevProps.screen) {
      this._updatePanelClass();
    }
  }

  /**
   * Reach outside the component to change the modal size. This is a little gross and would probably
   * ideally be done by the thing that creates the modal panel.
   */
  _updatePanelClass = () => {
    const el = ReactDOM.findDOMNode(this);
    if (!(el instanceof Element)) {
      return;
    }
    const panelEl = el.closest('atom-panel');
    if (panelEl == null) {
      return;
    }

    // Remove existing classes.
    ['connect', 'create-connection'].forEach(screen => {
      panelEl.classList.remove(`nuclide-remote-projects-panel-${screen}`);
    });

    // Add a class for the current screen.
    panelEl.classList.add(`nuclide-remote-projects-panel-${this.props.screen}`);
  };

  render(): React.Node {
    switch (this.props.screen) {
      case 'connect':
        return (
          <ConnectionDialog
            selectedProfileIndex={this.props.selectedProfileIndex}
            connectionProfiles={this.props.connectionProfiles}
            onAddProfileClicked={() => {
              this.props.onScreenChange('create-connection');
            }}
            onCancel={this.props.onCancel}
            onClosed={this.props.onClosed}
            onConnect={this.props.onConnect}
            onError={this.props.onError}
            onDeleteProfileClicked={this.props.onDeleteProfileClicked}
            onSaveProfile={this.props.onSaveProfile}
            onProfileSelected={this.props.onProfileSelected}
          />
        );
      case 'create-connection':
        return (
          <CreateConnectionProfileForm
            onCancel={() => {
              this.props.onScreenChange('connect');
            }}
            onSave={this.props.onProfileCreated}
            initialFormFields={this.props.initialFormFields}
            profileHosts={getUniqueHostsForProfiles(
              this.props.connectionProfiles,
            )}
          />
        );
      default:
        (this.props.screen: empty);
        throw new Error(`Invalid screen: ${this.props.screen}`);
    }
  }
}
