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

import * as React from 'react';
import {Modal} from '../../nuclide-ui/Modal';
import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import {Button, ButtonTypes} from 'nuclide-commons-ui/Button';
import {ButtonGroup} from 'nuclide-commons-ui/ButtonGroup';

type Props = {
  projectStore: ProjectStore,
  onDismiss: () => void,
};

type State = {
  args: string,
};

export class HhvmToolbarSettings extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      args: this.props.projectStore.getScriptArguments(),
    };
  }

  render(): React.Node {
    return (
      <Modal onDismiss={this.props.onDismiss}>
        <div className="block">
          <div className="block">
            <h1>Script Debug Settings</h1>
            <label>Script arguments:</label>
            <AtomInput
              autofocus={true}
              value={this.state.args}
              onDidChange={newValue => this.setState({args: newValue})}
              size="sm"
            />
          </div>
          <div className="nuclide-hhvm-toolbar-settings">
            <ButtonGroup>
              <Button onClick={() => this.props.onDismiss()}>Cancel</Button>
              <Button
                buttonType={ButtonTypes.PRIMARY}
                onClick={() => {
                  this.props.projectStore.setScriptArguments(this.state.args);
                  this.props.onDismiss();
                }}>
                Save
              </Button>
            </ButtonGroup>
          </div>
        </div>
      </Modal>
    );
  }
}
