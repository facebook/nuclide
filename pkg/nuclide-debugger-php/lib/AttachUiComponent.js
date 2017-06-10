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

import React from 'react';
import {AttachProcessInfo} from './AttachProcessInfo';
import {Dropdown} from '../../nuclide-ui/Dropdown';
import {RemoteConnection} from '../../nuclide-remote-connection';
import nuclideUri from 'nuclide-commons/nuclideUri';
import consumeFirstProvider from '../../commons-atom/consumeFirstProvider';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {
  serializeDebuggerConfig,
  deserializeDebuggerConfig,
} from '../../nuclide-debugger-base';

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

type PropsType = {
  targetUri: NuclideUri,
  configIsValidChanged: (valid: boolean) => void,
};

type StateType = {
  selectedPathIndex: number,
  pathMenuItems: Array<{label: string, value: number}>,
};

export class AttachUiComponent
  extends React.Component<void, PropsType, StateType> {
  props: PropsType;
  state: StateType;
  _disposables: UniversalDisposable;

  constructor(props: PropsType) {
    super(props);
    (this: any)._handleAttachButtonClick = this._handleAttachButtonClick.bind(
      this,
    );
    (this: any)._handlePathsDropdownChange = this._handlePathsDropdownChange.bind(
      this,
    );
    this._disposables = new UniversalDisposable();
    this.state = {
      selectedPathIndex: 0,
      pathMenuItems: this._getPathMenuItems(),
    };
  }

  _getSerializationArgs() {
    return [
      nuclideUri.isRemote(this.props.targetUri)
        ? nuclideUri.getHostname(this.props.targetUri)
        : 'local',
      'attach',
      'php',
    ];
  }

  componentDidMount(): void {
    deserializeDebuggerConfig(
      ...this._getSerializationArgs(),
      (transientSettings, savedSettings) => {
        const savedPath = this.state.pathMenuItems.find(
          item => item.label === savedSettings.selectedPath,
        );
        if (savedPath != null) {
          this.setState({
            selectedPathIndex: this.state.pathMenuItems.indexOf(savedPath),
          });
        }
      },
    );

    this.props.configIsValidChanged(this._debugButtonShouldEnable());
    this._disposables.add(
      atom.commands.add('atom-workspace', {
        'core:confirm': () => {
          if (this._debugButtonShouldEnable()) {
            this._handleAttachButtonClick();
          }
        },
      }),
    );
  }

  componentWillUnmount() {
    this._disposables.dispose();
  }

  setState(newState: Object): void {
    super.setState(newState);
    this.props.configIsValidChanged(this._debugButtonShouldEnable());
  }

  _debugButtonShouldEnable(): boolean {
    return true;
  }

  render(): React.Element<any> {
    return (
      <div className="block">
        <div className="nuclide-debugger-php-launch-attach-ui-select-project">
          <label>Selected Project Directory: </label>
          <Dropdown
            className="inline-block nuclide-debugger-connection-box"
            options={this.state.pathMenuItems}
            onChange={this._handlePathsDropdownChange}
            value={this.state.selectedPathIndex}
          />
        </div>
      </div>
    );
  }

  _getPathMenuItems(): Array<{label: string, value: number}> {
    const connections = RemoteConnection.getByHostname(
      nuclideUri.getHostname(this.props.targetUri),
    );
    return connections.map((connection, index) => {
      const pathToProject = connection.getPathForInitialWorkingDirectory();
      return {
        label: pathToProject,
        value: index,
      };
    });
  }

  _handlePathsDropdownChange(newIndex: number): void {
    this.setState({
      selectedPathIndex: newIndex,
      pathMenuItems: this._getPathMenuItems(),
    });
  }

  _handleAttachButtonClick(): void {
    // Start a debug session with the user-supplied information.
    const {hostname} = nuclideUri.parseRemoteUri(this.props.targetUri);
    const selectedPath = this.state.pathMenuItems[this.state.selectedPathIndex]
      .label;
    const processInfo = new AttachProcessInfo(
      nuclideUri.createRemoteUri(hostname, selectedPath),
    );
    consumeFirstProvider('nuclide-debugger.remote').then(debuggerService =>
      debuggerService.startDebugging(processInfo),
    );

    serializeDebuggerConfig(...this._getSerializationArgs(), {
      selectedPath,
    });
  }
}
