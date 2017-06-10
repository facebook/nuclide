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

import {shellParse} from 'nuclide-commons/string';

import type {LaunchAttachStore} from './LaunchAttachStore';
import type {LaunchAttachActions} from './LaunchAttachActions';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import React from 'react';
import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {
  serializeDebuggerConfig,
  deserializeDebuggerConfig,
} from '../../nuclide-debugger-base';

type PropsType = {
  targetUri: NuclideUri,
  store: LaunchAttachStore,
  actions: LaunchAttachActions,
  configIsValidChanged: (valid: boolean) => void,
};

type StateType = {
  launchExecutable: string,
  launchArguments: string,
  launchEnvironmentVariables: string,
  launchWorkingDirectory: string,
  stdinFilePath: string,
};

export class LaunchUIComponent
  extends React.Component<void, PropsType, StateType> {
  props: PropsType;
  state: StateType;
  _disposables: UniversalDisposable;

  constructor(props: PropsType) {
    super(props);
    (this: any)._handleLaunchClick = this._handleLaunchClick.bind(this);

    this._disposables = new UniversalDisposable();
    this.state = {
      launchExecutable: '',
      launchArguments: '',
      launchEnvironmentVariables: '',
      launchWorkingDirectory: '',
      stdinFilePath: '',
    };
  }

  _getSerializationArgs() {
    return [
      nuclideUri.isRemote(this.props.targetUri)
        ? nuclideUri.getHostname(this.props.targetUri)
        : 'local',
      'launch',
      'native',
    ];
  }

  setState(newState: Object): void {
    super.setState(newState);
    this.props.configIsValidChanged(this._debugButtonShouldEnable());
  }

  _debugButtonShouldEnable(): boolean {
    return true;
  }

  componentDidMount(): void {
    deserializeDebuggerConfig(
      ...this._getSerializationArgs(),
      (transientSettings, savedSettings) => {
        this.setState({
          launchExecutable: savedSettings.launchExecutable,
          launchArguments: savedSettings.launchArguments,
          launchEnvironmentVariables: savedSettings.launchEnvironmentVariables,
          launchWorkingDirectory: savedSettings.launchWorkingDirectory,
          stdinFilePath: savedSettings.stdinFilePath,
        });
      },
    );

    const launchExecutableInput = this.refs.launchExecutable;
    if (launchExecutableInput != null) {
      launchExecutableInput.focus();
    }

    this._disposables.add(
      atom.commands.add('atom-workspace', {
        'core:confirm': () => {
          this._handleLaunchClick();
        },
      }),
    );

    this.props.configIsValidChanged(true);
  }

  componentWillUnmount() {
    this._disposables.dispose();
  }

  render(): React.Element<any> {
    // TODO: smart fill the working directory textbox.
    // TODO: make tab stop between textbox work.
    // Reserve tabIndex [1~10] to header portion of the UI so we start from "11" here.
    return (
      <div className="block">
        <label>Executable: </label>
        <AtomInput
          ref="launchExecutable"
          tabIndex="11"
          placeholderText="Input the executable path you want to launch"
          value={this.state.launchExecutable}
          onDidChange={value => this.setState({launchExecutable: value})}
        />
        <label>Arguments: </label>
        <AtomInput
          ref="launchArguments"
          tabIndex="12"
          placeholderText="Arguments to the executable"
          value={this.state.launchArguments}
          onDidChange={value => this.setState({launchArguments: value})}
        />
        <label>Environment Variables: </label>
        <AtomInput
          ref="launchEnvironmentVariables"
          tabIndex="13"
          placeholderText="Environment variables (e.g., SHELL=/bin/bash PATH=/bin)"
          value={this.state.launchEnvironmentVariables}
          onDidChange={value =>
            this.setState({launchEnvironmentVariables: value})}
        />
        <label>Working directory: </label>
        <AtomInput
          ref="launchWorkingDirectory"
          tabIndex="14"
          placeholderText="Working directory for the launched executable"
          value={this.state.launchWorkingDirectory}
          onDidChange={value => this.setState({launchWorkingDirectory: value})}
        />
        <label>Stdin file: </label>
        <AtomInput
          ref="stdinFilePath"
          tabIndex="15"
          placeholderText="Redirect stdin to this file"
          value={this.state.stdinFilePath}
          onDidChange={value => this.setState({stdinFilePath: value})}
        />
      </div>
    );
  }

  _handleLaunchClick(): void {
    // TODO: perform some validation for the input.
    const launchExecutable = this.refs.launchExecutable.getText().trim();
    const launchArguments = shellParse(this.refs.launchArguments.getText());
    const launchEnvironmentVariables = shellParse(
      this.refs.launchEnvironmentVariables.getText(),
    );
    const launchWorkingDirectory = this.refs.launchWorkingDirectory
      .getText()
      .trim();
    const stdinFilePath = this.refs.stdinFilePath.getText().trim();
    const launchTarget = {
      executablePath: launchExecutable,
      arguments: launchArguments,
      environmentVariables: launchEnvironmentVariables,
      workingDirectory: launchWorkingDirectory,
      stdinFilePath,
    };
    // Fire and forget.
    this.props.actions.launchDebugger(launchTarget);

    serializeDebuggerConfig(...this._getSerializationArgs(), {
      launchExecutable: this.state.launchExecutable,
      launchArguments: this.state.launchArguments,
      launchEnvironmentVariables: this.state.launchEnvironmentVariables,
      launchWorkingDirectory: this.state.launchWorkingDirectory,
      stdinFilePath: this.state.stdinFilePath,
    });
  }
}
