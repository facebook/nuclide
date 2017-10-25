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

import type ProjectStore from './ProjectStore';
import type {DebugMode} from './types';
import {shell} from 'electron';

import {HACK_GRAMMARS} from '../../nuclide-hack-common/lib/constants.js';
import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import {Dropdown} from '../../nuclide-ui/Dropdown';
import {Button, ButtonSizes} from 'nuclide-commons-ui/Button';
import {Checkbox} from 'nuclide-commons-ui/Checkbox';
import * as React from 'react';
import {HhvmToolbarSettings} from './HhvmToolbarSettings';

const WEB_SERVER_OPTION = {label: 'Attach to WebServer', value: 'webserver'};
const SCRIPT_OPTION = {label: 'Launch Script', value: 'script'};

const DEBUG_OPTIONS = [WEB_SERVER_OPTION, SCRIPT_OPTION];

const NO_LAUNCH_DEBUG_OPTIONS = [WEB_SERVER_OPTION];

type Props = {
  projectStore: ProjectStore,
};

type State = {
  stickyScript: boolean,
  useTerminal: boolean,
  settingsVisible: boolean,
};

export default class HhvmToolbar extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      stickyScript: false,
      useTerminal: false,
      settingsVisible: false,
    };
  }

  _updateLastScriptCommand = (command: string): void => {
    if (this.props.projectStore.getDebugMode() !== 'webserver') {
      if (this.state.stickyScript) {
        this.props.projectStore.setStickyCommand(command, true);
      } else {
        this.props.projectStore.updateLastScriptCommand(command);
      }
    }
  };

  _getMenuItems(): Array<{label: string, value: DebugMode}> {
    const additionalOptions = [];
    try {
      // $FlowFB: This is suppressed elsewhere, so vary the filename.
      const helpers = require('./fb-hhvm.js');
      additionalOptions.push(...helpers.getAdditionalLaunchOptions());
    } catch (e) {}

    return this._isTargetLaunchable(
      this.props.projectStore.getCurrentFilePath(),
    )
      ? DEBUG_OPTIONS.concat(additionalOptions)
      : NO_LAUNCH_DEBUG_OPTIONS;
  }

  _isTargetLaunchable(targetFilePath: string): boolean {
    if (targetFilePath.endsWith('.php') || targetFilePath.endsWith('.hh')) {
      return true;
    }
    return atom.workspace.getTextEditors().some(editor => {
      const editorPath = editor.getPath();
      if (editorPath != null && editorPath.endsWith(targetFilePath)) {
        const grammar = editor.getGrammar();
        return HACK_GRAMMARS.indexOf(grammar.scopeName) >= 0;
      }
      return false;
    });
  }

  componentWillReceiveProps(nextProps: Object) {
    // Reset selected item to webserver if target is not launchable anymore.
    // TODO[jeffreytan]: this is ugly, refactor to make it more elegant.
    const store = this.props.projectStore;
    if (
      store.getDebugMode() === 'script' &&
      !this.state.stickyScript &&
      !this._isTargetLaunchable(store.getCurrentFilePath())
    ) {
      store.setDebugMode('webserver');
    }
    this._suggestTargetIfCustomDebugMode(store.getDebugMode());
    this.refs.debugTarget.setText(store.getDebugTarget());
  }

  render(): React.Node {
    const store = this.props.projectStore;
    const isDebugScript = store.getDebugMode() !== 'webserver';
    const isDisabled = !isDebugScript;
    const value = store.getDebugTarget();

    return (
      <div className="hhvm-toolbar">
        {/* $FlowFixMe(>=0.53.0) Flow suppress */}
        <Dropdown
          className="inline-block"
          options={this._getMenuItems()}
          value={store.getDebugMode()}
          onChange={this._handleDropdownChange}
          ref="dropdown"
          size="sm"
        />
        <div className="inline-block" style={{width: '300px'}}>
          <AtomInput
            ref="debugTarget"
            value={value}
            // Ugly hack: prevent people changing the value without disabling so
            // that they can copy and paste.
            onDidChange={
              isDisabled
                ? () => {
                    if (this.refs.debugTarget.getText() !== value) {
                      this.refs.debugTarget.setText(value);
                    }
                  }
                : this._updateLastScriptCommand
            }
            size="sm"
          />
        </div>
        {store.getDebugMode() !== 'webserver' ? (
          <Button
            className="icon icon-gear"
            size={ButtonSizes.SMALL}
            title="Advanced settings"
            style={{'margin-right': '3px'}}
            onClick={() => this._showSettings()}
          />
        ) : null}
        {this.state.settingsVisible ? (
          <HhvmToolbarSettings
            projectStore={this.props.projectStore}
            onDismiss={() => this._hideSettings()}
          />
        ) : null}
        <div className="inline-block">
          {!isDebugScript ? (
            <Button
              size="SMALL"
              onClick={() => {
                shell.openExternal('https://' + store.getDebugTarget());
              }}>
              Open
            </Button>
          ) : (
            <Checkbox
              checked={this.state.stickyScript}
              label="Sticky"
              onChange={isChecked => {
                this.props.projectStore.setStickyCommand(
                  this.refs.debugTarget.getText(),
                  isChecked,
                );
                this.setState({stickyScript: isChecked});
              }}
              tooltip={{
                title:
                  'When checked, the target script will not change when switching to another editor tab',
              }}
            />
          )}
          {store.getDebugMode() === 'script' ? (
            <Checkbox
              checked={this.state.useTerminal}
              className="nuclide-hhvm-use-terminal-control"
              label="Run in Terminal"
              onChange={isChecked => {
                this.props.projectStore.setUseTerminal(isChecked);
                this.setState({useTerminal: isChecked});
              }}
              tooltip={{
                title:
                  "When checked, the target script's STDIN and STDOUT will be redirected to a new Nuclide Terminal pane",
              }}
            />
          ) : null}
        </div>
      </div>
    );
  }

  _showSettings(): void {
    this.setState({settingsVisible: true});
  }

  _hideSettings(): void {
    this.setState({settingsVisible: false});
  }

  _suggestTargetIfCustomDebugMode(debugMode: DebugMode) {
    const store = this.props.projectStore;
    // If a custom debug mode is selected, suggest a debug target for the user.
    if (DEBUG_OPTIONS.find(option => option.value === debugMode) == null) {
      try {
        // $FlowFB
        const helpers = require('./fb-hhvm');
        const suggestedTarget = helpers.suggestDebugTargetName(
          debugMode,
          store.getCurrentFilePath(),
        );
        store.updateLastScriptCommand(
          suggestedTarget != null ? suggestedTarget : '',
        );
      } catch (e) {}
    } else {
      store.updateLastScriptCommand('');
    }
  }

  _handleDropdownChange = (value: DebugMode) => {
    this.props.projectStore.setDebugMode(value);
    this._suggestTargetIfCustomDebugMode(value);
  };
}
