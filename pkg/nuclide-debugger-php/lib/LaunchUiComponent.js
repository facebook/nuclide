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

import * as React from 'react';
import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import {LaunchProcessInfo} from './LaunchProcessInfo';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {Dropdown} from '../../nuclide-ui/Dropdown';
import {RemoteConnection} from '../../nuclide-remote-connection';
import consumeFirstProvider from '../../commons-atom/consumeFirstProvider';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {
  serializeDebuggerConfig,
  deserializeDebuggerConfig,
} from '../../nuclide-debugger-base';
import {Checkbox} from 'nuclide-commons-ui/Checkbox';

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

const MAX_RECENTLY_LAUNCHED = 5;

type Props = {
  targetUri: NuclideUri,
  configIsValidChanged: (valid: boolean) => void,
};

type State = {
  recentlyLaunchedScripts: Array<{label: string, value: string}>,
  recentlyLaunchedScript: ?string,
  runInTerminal: boolean,
};

export class LaunchUiComponent extends React.Component<Props, State> {
  props: Props;
  state: State;
  _disposables: UniversalDisposable;

  constructor(props: Props) {
    super(props);
    this._disposables = new UniversalDisposable();
    this.state = {
      pathsDropdownIndex: 0,
      pathMenuItems: this._getPathMenuItems(),
      recentlyLaunchedScripts: this._getRecentlyLaunchedScripts(),
      recentlyLaunchedScript: null,
      runInTerminal: false,
    };
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
    super.setState(newState);
    this.props.configIsValidChanged(this._debugButtonShouldEnable());
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
          className="inline-block nuclide-debugger-recently-launched"
          options={[
            {label: '', value: null},
            ...this.state.recentlyLaunchedScripts,
          ]}
          onChange={this._handleRecentSelectionChange}
          value={this.state.recentlyLaunchedScript}
        />
        <label>Command: </label>
        <AtomInput
          ref="scriptPath"
          tabIndex="11"
          placeholderText="/path/to/my/script.php arg1 arg2"
          initialValue={this._getActiveFilePath()}
          value={this.state.recentlyLaunchedScript || ''}
          onDidChange={value => this.setState({recentlyLaunchedScript: value})}
        />
        <Checkbox
          checked={this.state.runInTerminal}
          label="Run in Terminal"
          ref="runInTerminal"
          onChange={checked => this.setState({runInTerminal: checked})}
          title="When checked, the target script's STDIN and STDOUT will be redirected to a new Nuclide Terminal pane"
        />
      </div>
    );
  }

  _getRecentlyLaunchedKey() {
    const hostname = nuclideUri.getHostname(this.props.targetUri);
    return 'nuclide-debugger-php.recentlyLaunchedScripts:' + hostname;
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
    this.setState({
      recentlyLaunchedScripts: this._getRecentlyLaunchedScripts(),
      recentlyLaunchedScript: script,
    });
  }

  _getPathMenuItems(): Array<{label: string, value: number}> {
    const hostname = nuclideUri.getHostname(this.props.targetUri);
    const connections = RemoteConnection.getByHostname(hostname);
    return connections.map((connection, index) => {
      const pathToProject = connection.getPathForInitialWorkingDirectory();
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

  _handleLaunchButtonClick = (): void => {
    const scriptPath = this.refs.scriptPath.getText().trim();
    this._setRecentlyLaunchedScript(
      scriptPath,
      this.state.recentlyLaunchedScripts,
    );

    const processInfo = new LaunchProcessInfo(
      this.props.targetUri,
      scriptPath,
      null,
      this.state.runInTerminal,
    );
    consumeFirstProvider('nuclide-debugger.remote').then(debuggerService =>
      debuggerService.startDebugging(processInfo),
    );

    serializeDebuggerConfig(...this._getSerializationArgs(), {
      scriptPath,
    });
  };

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
