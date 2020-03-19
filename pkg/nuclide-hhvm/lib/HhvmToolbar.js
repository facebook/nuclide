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

import type {DebugMode} from './types';
import type ProjectStore from './ProjectStore';

import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import {Button, ButtonSizes} from 'nuclide-commons-ui/Button';
import {Checkbox} from 'nuclide-commons-ui/Checkbox';
import {Dropdown} from 'nuclide-commons-ui/Dropdown';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {HhvmToolbarSettings} from './HhvmToolbarSettings';
import * as React from 'react';
import {shell} from 'electron';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

type Props = {
  projectStore: ProjectStore,
  debugOptions: Array<{
    label: string,
    value: DebugMode,
  }>,
};

type State = {
  stickyScript: boolean,
  useTerminal: boolean,
  settingsVisible: boolean,
  debugMode: DebugMode,
  launchTarget: string,
};

export default class HhvmToolbar extends React.Component<Props, State> {
  _disposables: UniversalDisposable;

  constructor(props: Props) {
    super(props);
    this._disposables = new UniversalDisposable();
    this.state = {
      ...this._getState(),
      settingsVisible: false,
    };

    this._disposables.add(
      observableFromSubscribeFunction(
        this.props.projectStore.onChange.bind(this.props.projectStore),
      ).subscribe(() => {
        this.setState({
          ...this._getState(),
        });
      }),
    );
  }

  _getState() {
    return {
      stickyScript: this.props.projectStore.getSticky(),
      useTerminal: this.props.projectStore.getUseTerminal(),
      debugMode: this.props.projectStore.getDebugMode(),
      launchTarget: this.props.projectStore.getLaunchTarget(),
    };
  }

  componentWillUnmount() {
    this._disposables.dispose();
  }

  render(): React.Node {
    const {
      stickyScript,
      useTerminal,
      settingsVisible,
      debugMode,
      launchTarget,
    } = this.state;
    const isDebugScript = debugMode !== 'webserver';
    const openFn = () => {
      const browserUri = launchTarget;
      const address = browserUri.trim().toLowerCase();
      if (!address.startsWith('http://') && !address.startsWith('https://')) {
        shell.openExternal('https://' + browserUri);
      } else {
        shell.openExternal(browserUri);
      }
    };

    return (
      <div className="hhvm-toolbar">
        {/* $FlowFixMe(>=0.53.0) Flow suppress */}
        <Dropdown
          className="inline-block"
          options={this.props.debugOptions}
          value={debugMode}
          onChange={this._handleDropdownChange}
          size="sm"
        />
        <div className="inline-block" style={{width: '300px'}}>
          <AtomInput
            value={launchTarget}
            onDidChange={this._handleTargetBoxChange}
            onConfirm={openFn}
            disabled={stickyScript}
            size="sm"
          />
        </div>
        {debugMode !== 'webserver' ? (
          <Button
            className="icon icon-gear"
            size={ButtonSizes.SMALL}
            title="Advanced settings"
            style={{'margin-right': '3px'}}
            onClick={() => this._showSettings()}
          />
        ) : null}
        {settingsVisible ? (
          <HhvmToolbarSettings
            projectStore={this.props.projectStore}
            onDismiss={() => this._hideSettings()}
          />
        ) : null}
        <div className="inline-block">
          {!isDebugScript ? (
            <Button size="SMALL" onClick={openFn}>
              Open In Browser
            </Button>
          ) : (
            <Checkbox
              checked={stickyScript}
              className="nuclide-hhvm-be-sticky-control"
              label="Sticky"
              onChange={isChecked => {
                this.props.projectStore.setSticky(isChecked);
              }}
              disabled={!this.props.projectStore.isCurrentSettingDebuggable()}
              tooltip={{
                title: this.props.projectStore.isCurrentSettingDebuggable()
                  ? 'When checked, the target script will not change when switching to another editor tab'
                  : 'The current HHVM debug settings are not valid.',
              }}
            />
          )}
          {debugMode === 'script' ? (
            <Checkbox
              checked={useTerminal}
              className="nuclide-hhvm-use-terminal-control"
              label="Run in Terminal"
              onChange={isChecked => {
                this.props.projectStore.setUseTerminal(isChecked);
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

  _handleDropdownChange = (value: DebugMode) => {
    if (this.props.projectStore.getSticky()) {
      this.props.projectStore.setSticky(false);
    }
    this.props.projectStore.setDebugMode(value);
  };

  _handleTargetBoxChange = (value: string) => {
    this.props.projectStore.setDebugTarget(value);
  };
}
