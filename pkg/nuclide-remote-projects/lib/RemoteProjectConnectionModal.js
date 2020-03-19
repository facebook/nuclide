/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

/* globals Element */

import type {NuclideRemoteConnectionProfile} from './connection-types';
import type {
  NuclideNewConnectionProfileInitialFields,
  NuclideRemoteConnectionParams,
} from './connection-types';
import type {SshConnectionConfiguration} from '../../nuclide-remote-connection/lib/SshHandshake';
import type {ConnectionDialogMode} from './ConnectionDialog';
import type {HumanizedErrorMessage} from './notification';

import {getUniqueHostsForProfiles} from './connection-profile-utils';
import ConnectionDialog from './ConnectionDialog';
import CreateConnectionProfileForm from './CreateConnectionProfileForm';
import * as React from 'react';
import ReactDOM from 'react-dom';

export type Screen = 'connect' | 'create-connection';

export type Props = {|
  connectionError: ?HumanizedErrorMessage,
  connectionFormDirty: boolean,
  setConnectionFormDirty: boolean => void,

  confirmConnectionPrompt: (answers: Array<string>) => void,
  connectionPromptInstructions: string,

  connectionDialogMode: ConnectionDialogMode,
  setConnectionDialogMode: ConnectionDialogMode => void,

  connect: SshConnectionConfiguration => void,
  cancelConnection: () => void,

  connectionProfiles: Array<NuclideRemoteConnectionProfile>,
  initialFormFields:
    | NuclideNewConnectionProfileInitialFields
    | NuclideRemoteConnectionParams,
  selectedProfileIndex: number,
  screen: Screen,
  onScreenChange: (screen: Screen) => mixed,

  onDeleteProfileClicked: (selectedProfileIndex: number) => mixed,
  onSaveProfile: (
    index: number,
    profile: NuclideRemoteConnectionProfile,
  ) => void,
  onProfileSelected: (selectedProfileIndex: number) => void,

  onProfileCreated: (profile: NuclideRemoteConnectionProfile) => mixed,
|};

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
            error={this.props.connectionError}
            dirty={this.props.connectionFormDirty}
            setDirty={this.props.setConnectionFormDirty}
            confirmConnectionPrompt={this.props.confirmConnectionPrompt}
            connectionPromptInstructions={
              this.props.connectionPromptInstructions
            }
            mode={this.props.connectionDialogMode}
            setMode={this.props.setConnectionDialogMode}
            connect={this.props.connect}
            cancelConnection={this.props.cancelConnection}
            selectedProfileIndex={this.props.selectedProfileIndex}
            connectionProfiles={this.props.connectionProfiles}
            onAddProfileClicked={() => {
              this.props.onScreenChange('create-connection');
            }}
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
