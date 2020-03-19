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

/* global localStorage */
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {IProcessConfig} from 'nuclide-debugger-common';

import * as React from 'react';
import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import {getDebuggerService} from 'nuclide-commons-atom/debugger';
import nuclideUri from 'nuclide-commons/nuclideUri';
import nullthrows from 'nullthrows';
import {Dropdown} from 'nuclide-commons-ui/Dropdown';
import {RemoteConnection} from '../../nuclide-remote-connection';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {
  serializeDebuggerConfig,
  deserializeDebuggerConfig,
} from 'nuclide-debugger-common';
import {Checkbox} from 'nuclide-commons-ui/Checkbox';

const MAX_RECENTLY_LAUNCHED = 5;

type Props = {
  targetUri: NuclideUri,
  configIsValidChanged: (valid: boolean) => void,
  getLaunchProcessConfig: (
    targetUri: NuclideUri,
    scriptPath: string,
    scriptArgs: string,
    scriptWrapperCommand: ?string,
    runInTerminal: boolean,
    cwdPath: string,
  ) => IProcessConfig,
};

type State = {
  recentlyLaunchedScripts: Array<{label: string, value: string}>,
  recentlyLaunchedScript: ?string,
  runInTerminal: boolean,
  cwd: ?string,
  scriptArgs: ?string,
};

export class LaunchUiComponent extends React.Component<Props, State> {
  _disposables: UniversalDisposable = new UniversalDisposable();
  _scriptPath: ?AtomInput;
  _scriptArgs: ?AtomInput;
  _cwdPath: ?AtomInput;

  constructor(props: Props) {
    super(props);
    (this: any)._handleLaunchButtonClick = this._handleLaunchButtonClick.bind(
      this,
    );

    this.state = {
      recentlyLaunchedScripts: this._getRecentlyLaunchedScripts(),
      recentlyLaunchedScript: null,
      runInTerminal: false,
      scriptArgs: null,
      cwd: this._getLastCwd(),
    };
  }

  _getHostName(): string {
    return nuclideUri.isRemote(this.props.targetUri)
      ? nuclideUri.getHostname(this.props.targetUri)
      : '';
  }

  _getSerializationArgs() {
    return [
      nuclideUri.isRemote(this.props.targetUri)
        ? nuclideUri.getHostname(this.props.targetUri)
        : 'local',
      'launch',
      'php',
    ];
  }

  componentDidMount(): void {
    deserializeDebuggerConfig(
      ...this._getSerializationArgs(),
      (transientSettings, savedSettings) => {
        this.setState({
          recentlyLaunchedScript: savedSettings.scriptPath || '',
          cwd: savedSettings.cwdPath || '',
          scriptArgs: savedSettings.scriptArgs || '',
        });
      },
    );
    this.props.configIsValidChanged(this._debugButtonShouldEnable());
    this._disposables.add(
      atom.commands.add('atom-workspace', {
        'core:confirm': () => {
          if (this._debugButtonShouldEnable()) {
            this._handleLaunchButtonClick();
          }
        },
      }),
    );
  }

  componentWillUnmount() {
    this._disposables.dispose();
  }

  setState(newState: Object): void {
    super.setState(newState, () =>
      this.props.configIsValidChanged(this._debugButtonShouldEnable()),
    );
  }

  _debugButtonShouldEnable(): boolean {
    return (
      this.state.recentlyLaunchedScript != null &&
      this.state.recentlyLaunchedScript.trim() !== ''
    );
  }

  render(): React.Node {
    return (
      <div className="block">
        <label>Recently launched commands: </label>
        {/* $FlowFixMe(>=0.53.0) Flow suppress */}
        <Dropdown
          className="inline-block debugger-recently-launched"
          options={[
            {label: '', value: null},
            ...this.state.recentlyLaunchedScripts,
          ]}
          onChange={this._handleRecentSelectionChange}
          value={this.state.recentlyLaunchedScript}
        />
        <label>Script path: </label>
        <AtomInput
          ref={input => {
            this._scriptPath = input;
          }}
          tabIndex="11"
          placeholderText="/path/to/my/script.php arg1 arg2"
          initialValue={this._getActiveFilePath()}
          value={this.state.recentlyLaunchedScript || ''}
          onDidChange={value => this.setState({recentlyLaunchedScript: value})}
        />
        <label>Script arguments: </label>
        <AtomInput
          ref={input => {
            this._scriptArgs = input;
          }}
          tabIndex="12"
          value={this.state.scriptArgs || ''}
          onDidChange={value => this.setState({scriptArgs: value})}
        />
        <label>Current Working Directory: </label>
        <AtomInput
          tabIndex="13"
          ref={input => {
            this._cwdPath = input;
          }}
          placeholderText="Optional. Working directory to launch script in."
          initialValue=""
          value={this.state.cwd || ''}
          onDidChange={value => this.setState({cwd: value})}
        />
        <Checkbox
          checked={this.state.runInTerminal}
          label="Run in Terminal"
          onChange={checked => this.setState({runInTerminal: checked})}
          title="When checked, the target script's STDIN and STDOUT will be redirected to a new Nuclide Terminal pane"
        />
      </div>
    );
  }

  _getRecentlyLaunchedKey() {
    const hostname = this._getHostName();
    return 'debugger-php.recentlyLaunchedScripts:' + hostname;
  }

  _getCwdKey() {
    const hostname = this._getHostName();
    return 'debugger-php.Cwd:' + hostname;
  }

  _getLastCwd(): ?string {
    const lastCwd = localStorage.getItem(this._getCwdKey());
    return lastCwd;
  }

  _getRecentlyLaunchedScripts(): Array<{label: string, value: string}> {
    const recentlyLaunched = localStorage.getItem(
      this._getRecentlyLaunchedKey(),
    );
    if (recentlyLaunched == null) {
      return [];
    }

    const items = JSON.parse(String(recentlyLaunched));
    return items.filter(script => script !== '').map(script => {
      return {
        label: script,
        value: script,
      };
    });
  }

  _setRecentlyLaunchedScript(
    script: string,
    recentlyLaunched: Array<{label: string, value: string}>,
    cwd: string,
  ): void {
    // Act like a simple MRU cache, move the script being launched to the front.
    // NOTE: this array is expected to be really tiny.
    const scriptNames = [script];
    recentlyLaunched.forEach(item => {
      if (item.label !== script && scriptNames.length < MAX_RECENTLY_LAUNCHED) {
        scriptNames.push(item.label);
      }
    });

    localStorage.setItem(
      this._getRecentlyLaunchedKey(),
      JSON.stringify(scriptNames),
    );
    localStorage.setItem(this._getCwdKey(), cwd);
    this.setState({
      recentlyLaunchedScripts: this._getRecentlyLaunchedScripts(),
      recentlyLaunchedScript: script,
    });
  }

  _getPathMenuItems(): Array<{label: string, value: number}> {
    const hostname = this._getHostName();
    const connections = RemoteConnection.getByHostname(hostname);
    return connections.map((connection, index) => {
      const pathToProject = connection.getPath();
      return {
        label: pathToProject,
        value: index,
      };
    });
  }

  _handleRecentSelectionChange = (newValue: string): void => {
    this.setState({
      recentlyLaunchedScript: newValue,
    });
  };

  async _handleLaunchButtonClick(): Promise<void> {
    const scriptPath = nullthrows(this._scriptPath)
      .getText()
      .trim();
    const cwdPath = nullthrows(this._cwdPath)
      .getText()
      .trim();
    const scriptArgs = nullthrows(this._scriptArgs)
      .getText()
      .trim();

    this._setRecentlyLaunchedScript(
      scriptPath,
      this.state.recentlyLaunchedScripts,
      cwdPath,
    );

    const processConfig = this.props.getLaunchProcessConfig(
      this.props.targetUri,
      scriptPath,
      scriptArgs,
      null,
      this.state.runInTerminal,
      cwdPath,
    );

    const debuggerService = await getDebuggerService();
    debuggerService.startVspDebugging(processConfig);

    serializeDebuggerConfig(...this._getSerializationArgs(), {
      scriptPath,
      scriptArgs,
      cwdPath,
    });
  }

  _getActiveFilePath = (): string => {
    const editor = atom.workspace.getActiveTextEditor();
    if (editor != null) {
      const fileUri = editor.getPath();
      if (fileUri != null && this._isValidScriptUri(fileUri)) {
        return nuclideUri.getPath(fileUri);
      }
    }
    return '';
  };

  _isValidScriptUri(uri: NuclideUri): boolean {
    if (!nuclideUri.isRemote(uri)) {
      return false;
    }
    const scriptPath = nuclideUri.getPath(uri);
    return scriptPath.endsWith('.php') || scriptPath.endsWith('.hh');
  }
}
