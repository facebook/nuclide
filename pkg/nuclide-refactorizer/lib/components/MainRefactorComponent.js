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

import type {Store, RefactorState} from '../types';

import * as React from 'react';
import invariant from 'assert';

import {Button} from 'nuclide-commons-ui/Button';

import {ConfirmRefactorComponent} from './ConfirmRefactorComponent';
import {FreeformRefactorComponent} from './FreeformRefactorComponent';
import {PickRefactorComponent} from './PickRefactorComponent';
import {ProgressComponent} from './ProgressComponent';
import {RenameComponent} from './RenameComponent';
import * as Actions from '../refactorActions';

type Props = {
  appState: RefactorState,
  store: Store,
};

export class MainRefactorComponent extends React.Component<Props> {
  render(): React.Element<any> | null {
    if (this.props.appState.type === 'closed') {
      return null;
    } else {
      // TODO consider passing appState in here so the refinement holds and we don't need an
      // invariant
      return this._render();
    }
  }

  _render(): React.Element<any> {
    return (
      <div>
        {this.getHeaderElement()}
        {this.getInnerElement()}
      </div>
    );
  }

  getHeaderElement(): React.Element<any> {
    const appState = this.props.appState;
    invariant(appState.type === 'open');
    return (
      <div className="nuclide-refactorizer-header">
        <span>Refactor</span>
        <Button onClick={() => this.props.store.dispatch(Actions.close())}>
          Close
        </Button>
      </div>
    );
  }

  getInnerElement(): React.Element<any> {
    const appState = this.props.appState;
    invariant(appState.type === 'open');
    const phase = appState.phase;
    switch (phase.type) {
      case 'get-refactorings':
        return <div>Waiting for refactorings...</div>;
      case 'pick':
        return (
          <PickRefactorComponent pickPhase={phase} store={this.props.store} />
        );
      case 'rename':
        return <RenameComponent phase={phase} store={this.props.store} />;
      case 'freeform':
        return (
          <FreeformRefactorComponent phase={phase} store={this.props.store} />
        );
      case 'execute':
        return <div>Executing refactoring...</div>;
      case 'confirm':
        return (
          <ConfirmRefactorComponent phase={phase} store={this.props.store} />
        );
      case 'progress':
        return <ProgressComponent phase={phase} />;
      default:
        (phase: empty);
        return <div />;
    }
  }
}
