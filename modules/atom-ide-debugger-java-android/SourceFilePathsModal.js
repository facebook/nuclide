/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import * as React from 'react';
import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import {ListView, ListViewItem} from 'nuclide-commons-ui/ListView';
import {ButtonGroup} from 'nuclide-commons-ui/ButtonGroup';
import {Button, ButtonTypes} from 'nuclide-commons-ui/Button';
import nullthrows from 'nullthrows';
import {track} from 'nuclide-commons/analytics';

type PropsType = {
  initialSourcePaths: Array<string>,
  sourcePathsChanged: (Array<string>) => void,
  onClosed: () => void,
};

type StateType = {
  currentPaths: Array<string>,
};

export class SourceFilePathsModal extends React.Component<
  PropsType,
  StateType,
> {
  _newSourcePath: ?AtomInput;
  _savedSourcePaths: Array<string> = [];
  state = {
    currentPaths: this.props.initialSourcePaths.slice(0),
  };

  _getSourcePathControls(): Array<React.Element<any>> {
    const items = [];
    const paths = Array.from(new Set(this.state.currentPaths));

    if (paths.length === 0) {
      return [
        <ListViewItem key={0} index={0}>
          <div>
            <i>(No custom source file paths have been specified)</i>
          </div>
        </ListViewItem>,
      ];
    }

    paths.forEach((path, idx) => {
      items.push(
        <ListViewItem key={idx} index={idx}>
          <div className="block">
            <i
              className="icon icon-x nuclide-source-content-x"
              title="Remove path"
              onClick={() => {
                this.state.currentPaths.splice(idx, 1);
                this.setState({
                  // TODO: (wbinnssmith) T30771435 this setState depends on current state
                  // and should use an updater function rather than an object
                  // eslint-disable-next-line react/no-access-state-in-setstate
                  currentPaths: this.state.currentPaths,
                });
              }}
            />
            <span>{path}</span>
          </div>
        </ListViewItem>,
      );
    });
    return items;
  }

  _addItem = () => {
    const text = nullthrows(this._newSourcePath)
      .getText()
      .trim()
      .replace(/;/g, ''); // Do not allow semicolons since we are using them
    // to delimit paths. TODO: handle paths that actually contain ;'s?

    if (text !== '') {
      this.state.currentPaths.push(text);
      nullthrows(this._newSourcePath).setText('');
      this.setState({
        // TODO: (wbinnssmith) T30771435 this setState depends on current state
        // and should use an updater function rather than an object
        // eslint-disable-next-line react/no-access-state-in-setstate
        currentPaths: this.state.currentPaths,
      });
    }
  };

  render(): React.Node {
    const sourcePaths = this._getSourcePathControls();
    return (
      <div className="sourcepath-modal">
        <div className="select-list">
          <h2>Configure source file paths:</h2>
          <div className="nuclide-source-add-content">
            <span>
              Nuclide will automatically search for source in your project root
              paths. You can add additional search paths here.
            </span>
          </div>
          <div className="sourcepath-add-bar">
            <AtomInput
              className="sourcepath-pane"
              ref={input => {
                this._newSourcePath = input;
              }}
              initialValue=""
              autofocus={true}
              placeholderText="Add a source file path..."
            />
            <Button
              onClick={this._addItem}
              title="Add Path"
              className="sourcepath-add-button">
              <i className="icon icon-plus" />
            </Button>
          </div>
          <div className="sourcepath-sources">
            <ListView alternateBackground={true}>{sourcePaths}</ListView>
          </div>
        </div>
        <div
          className="sourcepath-buttons"
          style={{display: 'flex', flexDirection: 'row-reverse'}}>
          <ButtonGroup>
            <Button tabIndex="17" onClick={this._cancelClick}>
              Cancel
            </Button>
            <Button
              buttonType={ButtonTypes.PRIMARY}
              tabIndex="16"
              onClick={this._handleSaveClick}>
              Save
            </Button>
          </ButtonGroup>
        </div>
      </div>
    );
  }

  _cancelClick = (): void => {
    this.setState({
      currentPaths: this._savedSourcePaths,
    });
    this.props.onClosed();
    track('fb-java-debugger-source-dialog-cancel', {});
  };

  _handleSaveClick = (): void => {
    this._addItem();
    this._savedSourcePaths = this.state.currentPaths.slice(0);
    this.props.sourcePathsChanged(this._savedSourcePaths);
    this.props.onClosed();
    track('fb-java-debugger-source-dialog-saved', {});
  };
}
