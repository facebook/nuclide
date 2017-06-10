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

import type {PlatformProviderSettings, TaskSettings} from '../types';

import React from 'react';
import {quote} from 'shell-quote';

import {shellParse} from 'nuclide-commons/string';
import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import {Button, ButtonTypes} from 'nuclide-commons-ui/Button';
import {ButtonGroup} from 'nuclide-commons-ui/ButtonGroup';
import {Modal} from '../../../nuclide-ui/Modal';

type Props = {
  currentBuckRoot: ?string,
  settings: TaskSettings,
  platformProviderSettings: ?PlatformProviderSettings,
  onDismiss: () => void,
  onSave: (settings: TaskSettings) => void,
};

type State = {
  buildArguments: string,
  runArguments: string,
};

export default class BuckToolbarSettings extends React.Component {
  props: Props;
  state: State;

  constructor(props: Props) {
    super(props);
    const {buildArguments, runArguments} = props.settings;
    this.state = {
      buildArguments: buildArguments == null ? '' : quote(buildArguments),
      runArguments: runArguments == null ? '' : quote(runArguments),
    };
  }

  render(): React.Element<any> {
    const extraSettingsUi = this.props.platformProviderSettings != null
      ? this.props.platformProviderSettings.ui
      : null;
    return (
      <Modal onDismiss={this.props.onDismiss}>
        <div className="block">
          <div className="block">
            <label>Current Buck root:</label>
            <p>
              <code>
                {this.props.currentBuckRoot || 'No Buck project found.'}
              </code>
            </p>
            <label>Build Arguments:</label>
            <AtomInput
              tabIndex="0"
              initialValue={this.state.buildArguments}
              placeholderText="Extra arguments to Buck itself (e.g. --num-threads 4)"
              onDidChange={this._onBuildArgsChange.bind(this)}
              onConfirm={this._onSave.bind(this)}
            />
            <div>
              <label>Run Arguments:</label>
              <AtomInput
                tabIndex="0"
                initialValue={this.state.runArguments}
                placeholderText="Custom command-line arguments to pass to the app/binary"
                onDidChange={this._onRunArgsChange.bind(this)}
                onConfirm={this._onSave.bind(this)}
              />
            </div>
            {extraSettingsUi}
          </div>
          <div style={{display: 'flex', justifyContent: 'flex-end'}}>
            <ButtonGroup>
              <Button onClick={this.props.onDismiss}>
                Cancel
              </Button>
              <Button
                buttonType={ButtonTypes.PRIMARY}
                onClick={this._onSave.bind(this)}>
                Save
              </Button>
            </ButtonGroup>
          </div>
        </div>
      </Modal>
    );
  }

  _onBuildArgsChange(args: string) {
    this.setState({buildArguments: args});
  }

  _onRunArgsChange(args: string) {
    this.setState({runArguments: args});
  }

  _onSave() {
    try {
      this.props.onSave({
        buildArguments: shellParse(this.state.buildArguments),
        runArguments: shellParse(this.state.runArguments),
      });
    } catch (err) {
      atom.notifications.addError('Could not parse arguments', {
        detail: err.stack,
      });
    }
    if (this.props.platformProviderSettings != null) {
      this.props.platformProviderSettings.onSave();
    }
  }
}
