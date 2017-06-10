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

import type {Store, RenamePhase} from '../types';

import React from 'react';

import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import {Button} from 'nuclide-commons-ui/Button';

import * as Actions from '../refactorActions';

type Props = {
  phase: RenamePhase,
  store: Store,
};

type State = {
  newName: string,
};

export class RenameComponent extends React.Component {
  props: Props;
  state: State;

  constructor(props: Props) {
    super(props);
    this.state = {
      newName: this.props.phase.symbolAtPoint.text,
    };
  }

  render(): React.Element<any> {
    return (
      <div>
        <AtomInput
          autofocus={true}
          startSelected={true}
          className="nuclide-refactorizer-rename-editor"
          initialValue={this.props.phase.symbolAtPoint.text}
          onDidChange={text => this.setState({newName: text})}
          onConfirm={() => this._runRename()}
        />
        <Button
          // Used to identify this element in integration tests
          className="nuclide-refactorizer-execute-button"
          onClick={() => this._runRename()}>
          Execute
        </Button>
      </div>
    );
  }

  _runRename(): void {
    const {newName} = this.state;
    const {symbolAtPoint, editor, originalPoint} = this.props.phase;
    const refactoring = {
      kind: 'rename',
      newName,
      originalPoint,
      symbolAtPoint,
      editor,
    };
    this.props.store.dispatch(
      Actions.execute(this.props.phase.provider, refactoring),
    );
  }
}
