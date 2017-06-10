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

import type {Store, PickPhase} from '../types';

import type {AvailableRefactoring} from '../..';

import React from 'react';

import {Button} from 'nuclide-commons-ui/Button';

import * as Actions from '../refactorActions';

export class PickRefactorComponent extends React.Component {
  props: {
    pickPhase: PickPhase,
    store: Store,
  };

  render(): React.Element<any> {
    const {availableRefactorings} = this.props.pickPhase;
    if (availableRefactorings.length === 0) {
      return <div>No refactorings available at this location</div>;
    }

    const elements = availableRefactorings.map((r, i) => (
      <div key={i} className="nuclide-refactorizer-refactor-option">
        {this._renderRefactorOption(r)}
      </div>
    ));
    // Class used to identify this element in integration tests
    return <div className="nuclide-refactorizer-pick-refactor">{elements}</div>;
  }

  _pickRefactor(refactoring: AvailableRefactoring): void {
    if (refactoring.kind === 'freeform' && refactoring.arguments.length === 0) {
      this.props.store.dispatch(
        Actions.execute(this.props.pickPhase.provider, {
          kind: 'freeform',
          editor: this.props.pickPhase.editor,
          originalPoint: this.props.pickPhase.originalPoint,
          id: refactoring.id,
          range: refactoring.range,
          arguments: new Map(),
        }),
      );
      return;
    }
    this.props.store.dispatch(Actions.pickedRefactor(refactoring));
  }

  _renderRefactorOption(refactoring: AvailableRefactoring): React.Element<any> {
    switch (refactoring.kind) {
      case 'rename':
        return (
          <Button
            // Used to identify this element in integration tests
            className="nuclide-refactorizer-pick-rename"
            onClick={() => {
              this._pickRefactor(refactoring);
            }}>
            Rename
          </Button>
        );
      case 'freeform':
        // TODO: Make sure the buttons are aligned.
        return (
          <div>
            <Button
              className="nuclide-refactorizer-button"
              onClick={() => {
                this._pickRefactor(refactoring);
              }}
              disabled={refactoring.disabled}>
              {refactoring.name}
            </Button>
            {refactoring.description}
          </div>
        );
      default:
        throw new Error(`Unknown refactoring kind ${refactoring.kind}`);
    }
  }
}
