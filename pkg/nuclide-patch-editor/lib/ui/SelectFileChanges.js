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
import type {ExtraFileChangesData, FileData} from '../types';

import {Checkbox} from 'nuclide-commons-ui/Checkbox';
import FileChanges from '../../../nuclide-ui/FileChanges';
import {SelectHunkChanges} from './SelectHunkChanges';
import React from 'react';
import {SelectedState} from '../constants';

type Props = {
  actionCreators: BoundActionCreators,
  fileData: FileData,
  patchId: string,
};

export class SelectFileChanges extends React.Component {
  props: Props;

  constructor(props: Props) {
    super(props);

    (this: any)._onToggleFile = this._onToggleFile.bind(this);
  }

  shouldComponentUpdate(nextProps: Props): boolean {
    return this.props.fileData !== nextProps.fileData;
  }

  render(): React.Element<any> {
    const {actionCreators, fileData, patchId} = this.props;
    const {selected, fileDiff} = fileData;

    const extraData: ExtraFileChangesData = {
      actionCreators,
      fileData,
      patchId,
    };

    return (
      <div className="nuclide-patch-editor-select-file-changes">
        <Checkbox
          checked={selected === SelectedState.ALL}
          className="nuclide-patch-editor-file-checkbox"
          indeterminate={selected === SelectedState.SOME}
          onChange={this._onToggleFile}
        />
        <div className="nuclide-patch-editor-file-changes">
          <FileChanges
            collapsable={true}
            diff={fileDiff}
            extraData={extraData}
            hunkComponentClass={SelectHunkChanges}
          />
        </div>
      </div>
    );
  }

  _onToggleFile(): void {
    this.props.actionCreators.toggleFile(
      this.props.patchId,
      this.props.fileData.id,
    );
  }
}
