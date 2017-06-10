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

import type {ExtraFileChangesData, HunkData} from '../types';
import type {HunkProps} from '../../../nuclide-ui/FileChanges';

import {Checkbox} from 'nuclide-commons-ui/Checkbox';
import {GutterCheckbox} from './GutterCheckbox';
import {HunkDiff} from '../../../nuclide-ui/FileChanges';
import nullthrows from 'nullthrows';
import React from 'react';
import {SelectedState} from '../constants';

type Props = HunkProps;

type State = {
  editor: ?atom$TextEditor,
  firstChangeIndex: number,
  hunkData: HunkData,
};

function getExtraData(props: Props): ExtraFileChangesData {
  return (nullthrows(props.extraData): any);
}

function getHunkData(props: Props): HunkData {
  const hunks = nullthrows(getExtraData(props).fileData.chunks);
  return nullthrows(hunks.get(props.hunk.oldStart));
}

export class SelectHunkChanges extends React.Component {
  props: Props;
  state: State;
  _onToggleHunk: () => mixed;

  constructor(props: Props) {
    super(props);

    const {actionCreators, fileData: {id: fileId}, patchId} = getExtraData(
      props,
    );
    this._onToggleHunk = () =>
      actionCreators.toggleHunk(patchId, fileId, props.hunk.oldStart);

    const hunkData = getHunkData(props);
    const firstChangeIndex = props.hunk.changes.findIndex(
      change => change.type !== 'normal',
    );

    this.state = {editor: null, firstChangeIndex, hunkData};
  }

  componentWillReceiveProps(nextProps: Props) {
    const hunkData = getHunkData(nextProps);
    this.setState({hunkData});
  }

  shouldComponentUpdate(nextProps: Props, nextState: State): boolean {
    if (nextState.hunkData !== this.state.hunkData) {
      return true;
    }

    if (nextState.editor !== this.state.editor) {
      return true;
    }

    return false;
  }

  render(): React.Element<any> {
    const {actionCreators, fileData: {id: fileId}, patchId} = getExtraData(
      this.props,
    );

    let gutterCheckboxes;
    const {editor} = this.state;
    if (editor != null) {
      gutterCheckboxes = this.state.hunkData.allChanges.map(
        (isEnabled, index) => (
          <GutterCheckbox
            checked={isEnabled}
            editor={editor}
            key={index}
            lineNumber={index + this.state.firstChangeIndex}
            onToggleLine={() =>
              actionCreators.toggleLine(
                patchId,
                fileId,
                this.props.hunk.oldStart,
                index,
              )}
          />
        ),
      );
    }

    return (
      <div className="nuclide-patch-editor-select-hunk-changes">
        <Checkbox
          checked={this.state.hunkData.selected === SelectedState.ALL}
          className="nuclide-patch-editor-hunk-checkbox"
          indeterminate={this.state.hunkData.selected === SelectedState.SOME}
          onChange={this._onToggleHunk}
        />
        <div className="nuclide-patch-editor-hunk-changes">
          <HunkDiff
            {...this.props}
            ref={hunk => hunk && this.setState({editor: hunk.editor})}
          />
        </div>
        {gutterCheckboxes}
      </div>
    );
  }
}
