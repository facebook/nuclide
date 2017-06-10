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

import typeof * as BoundActionCreators from '../redux/Actions';
import type {PatchData} from '../types';

import React from 'react';
import {Button} from 'nuclide-commons-ui/Button';
import {ButtonGroup} from 'nuclide-commons-ui/ButtonGroup';
import {patchToString} from '../utils';
import {SelectFileChanges} from './SelectFileChanges';

type Props = {
  actionCreators: BoundActionCreators,
  onConfirm: string => mixed,
  onManualEdit: () => mixed,
  onQuit: () => mixed,
  patchId: string,
  patchData: PatchData,
};

export default class PatchEditor extends React.Component {
  props: Props;
  _patch: Array<diffparser$FileDiff>;

  constructor(props: Props) {
    super(props);

    (this: any)._onClickConfirm = this._onClickConfirm.bind(this);
    (this: any)._onClickDirectEdit = this._onClickDirectEdit.bind(this);
    (this: any)._onClickQuit = this._onClickQuit.bind(this);
  }

  render(): React.Element<any> {
    const files = Array.from(this.props.patchData.files.values());
    return (
      <div className="nuclide-patch-editor">
        <ButtonGroup>
          <Button onClick={this._onClickConfirm}>Confirm</Button>
          <Button onClick={this._onClickQuit}>Quit</Button>
          <Button onClick={this._onClickDirectEdit}>Direct Edit</Button>
        </ButtonGroup>
        {files.map(file => {
          return (
            <SelectFileChanges
              actionCreators={this.props.actionCreators}
              fileData={file}
              key={file.id}
              patchId={this.props.patchId}
            />
          );
        })}
      </div>
    );
  }

  _onClickConfirm(): void {
    this.props.onConfirm(patchToString(this.props.patchData));
  }

  // The "Direct Edit" button removes the patch editor UI and allows the user
  // to edit the text representation of the patch directly
  _onClickDirectEdit(): void {
    this.props.onManualEdit();
  }

  _onClickQuit(): void {
    this.props.onQuit();
  }
}
