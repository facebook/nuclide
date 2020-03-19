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

import * as React from 'react';
import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import {Button, ButtonTypes} from 'nuclide-commons-ui/Button';
import {ButtonGroup} from 'nuclide-commons-ui/ButtonGroup';
import {Dropdown} from 'nuclide-commons-ui/Dropdown';
import {Modal} from 'nuclide-commons-ui/Modal';

type Props = {
  configuration: string,
  Xcc: string,
  Xlinker: string,
  Xswiftc: string,
  buildPath: string,
  onDismiss: () => void,
  onSave: (
    configuration: string,
    Xcc: string,
    Xlinker: string,
    Xswiftc: string,
    buildPath: string,
  ) => void,
};

type State = {
  configuration: string,
  Xcc: string,
  Xlinker: string,
  Xswiftc: string,
  buildPath: string,
};

export default class SwiftPMSettingsModal extends React.Component<
  Props,
  State,
> {
  constructor(props: Props) {
    super(props);
    this.state = {
      configuration: props.configuration,
      Xcc: props.Xcc,
      Xlinker: props.Xlinker,
      Xswiftc: props.Xswiftc,
      buildPath: props.buildPath,
    };
  }

  render(): React.Node {
    return (
      <Modal onDismiss={this.props.onDismiss}>
        <div className="block">
          <label>Build configuration:</label>
          <div className="block">
            <Dropdown
              className="inline-block"
              value={this.state.configuration}
              options={[
                {label: 'Debug', value: 'debug'},
                {label: 'Release', value: 'release'},
              ]}
              onChange={this._onConfigurationChange.bind(this)}
              title="Choose build configuration"
            />
          </div>
          <label>C compiler flags:</label>
          <div className="block">
            <AtomInput
              initialValue={this.state.Xcc}
              placeholderText="Flags that are passed through to all C compiler invocations"
              onDidChange={this._onXccChange.bind(this)}
              onConfirm={this._onSave.bind(this)}
            />
          </div>
          <label>Linker flags:</label>
          <div className="block">
            <AtomInput
              initialValue={this.state.Xlinker}
              placeholderText="Flags that are passed through to all linker invocations"
              onDidChange={this._onXlinkerChange.bind(this)}
              onConfirm={this._onSave.bind(this)}
            />
          </div>
          <label>Swift compiler flags:</label>
          <div className="block">
            <AtomInput
              initialValue={this.state.Xswiftc}
              placeholderText="Flags that are passed through to all Swift compiler invocations"
              onDidChange={this._onXswiftcChange.bind(this)}
              onConfirm={this._onSave.bind(this)}
            />
          </div>
          <label>Build path:</label>
          <div className="block">
            <AtomInput
              initialValue={this.state.buildPath}
              placeholderText="Build directory path"
              onDidChange={this._onBuildPathChange.bind(this)}
              onConfirm={this._onSave.bind(this)}
            />
          </div>
          <div style={{display: 'flex', justifyContent: 'flex-end'}}>
            <ButtonGroup>
              <Button onClick={this.props.onDismiss}>Cancel</Button>
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

  _onConfigurationChange(configuration: string) {
    this.setState({configuration});
  }

  _onXccChange(Xcc: string) {
    this.setState({Xcc});
  }

  _onXlinkerChange(Xlinker: string) {
    this.setState({Xlinker});
  }

  _onXswiftcChange(Xswiftc: string) {
    this.setState({Xswiftc});
  }

  _onBuildPathChange(buildPath: string) {
    this.setState({buildPath});
  }

  _onSave() {
    this.props.onSave(
      this.state.configuration,
      this.state.Xcc,
      this.state.Xlinker,
      this.state.Xswiftc,
      this.state.buildPath,
    );
  }
}
