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

type Props = {
  isEditing: boolean,
  initialName: string,
  onUpdate: (prevName: string, name: string) => void,
  onSave: (name: string) => void,
  onCancel: () => void,
};

type State = {
  name: string,
};

export class WorkingSetNameAndSaveComponent extends React.Component<
  Props,
  State,
> {
  constructor(props: Props) {
    super(props);

    this.state = {
      name: props.initialName,
    };
  }

  componentDidMount(): void {}

  componentWillUnmount(): void {}

  render() {
    let setNameText;
    if (this.state.name === '') {
      setNameText = (
        <atom-panel class="nuclide-file-tree-working-set-name-missing">
          Name is missing
        </atom-panel>
      );
    }

    return (
      <div>
        <div className="nuclide-file-tree-working-set-name-outline">
          <AtomInput
            placeholderText="name"
            size="sm"
            className="nuclide-file-tree-working-set-name inline-block-tight"
            onDidChange={this._trackName}
            initialValue={this.props.initialName}
            onConfirm={this._saveWorkingSet}
            onCancel={this.props.onCancel}
          />
        </div>
        <Button
          buttonType={ButtonTypes.SUCCESS}
          disabled={this.state.name === ''}
          icon="check"
          onClick={this._saveWorkingSet}
        />
        {setNameText}
      </div>
    );
  }

  _trackName = (text: string): void => {
    this.setState({name: text});
  };

  _saveWorkingSet = (): void => {
    if (this.state.name === '') {
      atom.notifications.addWarning('Name is missing', {
        detail: 'Please provide a name for the Working Set',
      });
      return;
    }

    if (this.props.isEditing) {
      this.props.onUpdate(this.props.initialName, this.state.name);
    } else {
      this.props.onSave(this.state.name);
    }
  };
}
