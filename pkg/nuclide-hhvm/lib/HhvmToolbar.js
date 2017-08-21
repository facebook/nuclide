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
import {Button} from 'nuclide-commons-ui/Button';
import React from 'react';

const WEB_SERVER_OPTION = {label: 'Attach to WebServer', value: 'webserver'};
const SCRIPT_OPTION = {label: 'Launch Script', value: 'script'};

const DEBUG_OPTIONS = [WEB_SERVER_OPTION, SCRIPT_OPTION];

const NO_LAUNCH_DEBUG_OPTIONS = [WEB_SERVER_OPTION];

type Props = {
  projectStore: ProjectStore,
};

export default class HhvmToolbar extends React.Component {
  props: Props;

  _updateLastScriptCommand = (command: string): void => {
    if (this.props.projectStore.getDebugMode() !== 'webserver') {
      this.props.projectStore.updateLastScriptCommand(command);
    }
  };

  _getMenuItems(): Array<{label: string, value: DebugMode}> {
    const additionalOptions = [];
    try {
      // $FlowFB: This is suppressed elsewhere, so vary the filename.
      const helpers = require('./fb-hhvm.js');
      additionalOptions.push(...helpers.getAdditionalLaunchOptions());
    } catch (e) {}

    return (this._isTargetLaunchable(
      this.props.projectStore.getCurrentFilePath(),
    )
      ? DEBUG_OPTIONS
      : NO_LAUNCH_DEBUG_OPTIONS).concat(additionalOptions);
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
      !this._isTargetLaunchable(store.getCurrentFilePath())
    ) {
      store.setDebugMode('webserver');
    }
    this._suggestTargetIfCustomDebugMode(store.getDebugMode());
    this.refs.debugTarget.setText(store.getDebugTarget());
  }

  render(): React.Element<any> {
    const store = this.props.projectStore;
    const isDebugScript = store.getDebugMode() !== 'webserver';
    const isDisabled = !isDebugScript;
    const value = store.getDebugTarget();

    return (
      <div className="hhvm-toolbar">
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
            initialValue={value}
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
        {!isDebugScript
          ? <Button
              size="SMALL"
              onClick={() => {
                shell.openExternal('https://' + store.getDebugTarget());
              }}>
              Open
            </Button>
          : null}
      </div>
    );
  }

  _suggestTargetIfCustomDebugMode(debugMode: DebugMode) {
    // If a custom debug mode is selected, suggest a debug target for the user.
    if (DEBUG_OPTIONS.find(option => option.value === debugMode) == null) {
      try {
        // $FlowFB
        const helpers = require('./fb-hhvm');
        const store = this.props.projectStore;
        const suggestedTarget = helpers.suggestDebugTargetName(
          debugMode,
          store.getCurrentFilePath(),
        );
        if (suggestedTarget != null) {
          store.updateLastScriptCommand(suggestedTarget);
        }
      } catch (e) {}
    }
  }

  _handleDropdownChange = (value: DebugMode) => {
    this.props.projectStore.setDebugMode(value);
    this._suggestTargetIfCustomDebugMode(value);
  };
}
