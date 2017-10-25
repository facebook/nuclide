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

import type SwiftPMTaskRunnerStore from '../SwiftPMTaskRunnerStore';
import type SwiftPMTaskRunnerActions from '../SwiftPMTaskRunnerActions';

import * as React from 'react';
import {Button, ButtonSizes} from 'nuclide-commons-ui/Button';
import SwiftPMSettingsModal from './SwiftPMSettingsModal';

type Props = {
  store: SwiftPMTaskRunnerStore,
  actions: SwiftPMTaskRunnerActions,
};

type State = {settingsVisible: boolean};

export default class SwiftPMTaskRunnerToolbar extends React.Component<
  Props,
  State,
> {
  constructor(props: Props) {
    super(props);
    this.state = {settingsVisible: false};
  }

  render(): React.Node {
    return (
      <div className="nuclide-swift-task-runner-toolbar">
        <Button
          className="nuclide-swift-settings icon icon-gear"
          size={ButtonSizes.SMALL}
          onClick={() => this._showSettings()}
        />
        {this.state.settingsVisible ? (
          <SwiftPMSettingsModal
            configuration={this.props.store.getConfiguration()}
            Xcc={this.props.store.getXcc()}
            Xlinker={this.props.store.getXlinker()}
            Xswiftc={this.props.store.getXswiftc()}
            buildPath={this.props.store.getBuildPath()}
            onDismiss={() => this._hideSettings()}
            onSave={(configuration, Xcc, Xlinker, Xswiftc, buildPath) =>
              this._saveSettings(
                configuration,
                Xcc,
                Xlinker,
                Xswiftc,
                buildPath,
              )}
          />
        ) : null}
      </div>
    );
  }

  _showSettings() {
    this.setState({settingsVisible: true});
  }

  _hideSettings() {
    this.setState({settingsVisible: false});
  }

  _saveSettings(
    configuration: string,
    Xcc: string,
    Xlinker: string,
    Xswiftc: string,
    buildPath: string,
  ) {
    this.props.actions.updateSettings(
      configuration,
      Xcc,
      Xlinker,
      Xswiftc,
      buildPath,
    );
    this._hideSettings();
  }
}
