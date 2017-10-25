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

import type {
  ExpansionResult,
  EvaluatedExpression,
  EvaluatedExpressionList,
} from './types';
import {WatchExpressionStore} from './WatchExpressionStore';
import type {Observable} from 'rxjs';

import * as React from 'react';
import classnames from 'classnames';
import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import {bindObservableAsProps} from 'nuclide-commons-ui/bindObservableAsProps';
import {LazyNestedValueComponent} from '../../nuclide-ui/LazyNestedValueComponent';
import SimpleValueComponent from '../../nuclide-ui/SimpleValueComponent';
import {Icon} from 'nuclide-commons-ui/Icon';

type Props = {
  watchExpressions: EvaluatedExpressionList,
  onAddWatchExpression: (expression: string) => void,
  onRemoveWatchExpression: (index: number) => void,
  onUpdateWatchExpression: (index: number, newExpression: string) => void,
  watchExpressionStore: WatchExpressionStore,
};

type State = {
  rowBeingEdited: ?number,
};

export class WatchExpressionComponent extends React.PureComponent<
  Props,
  State,
> {
  coreCancelDisposable: ?IDisposable;
  _expansionStates: Map<
    string /* expression */,
    /* unique reference for expression */ Object,
  >;

  constructor(props: Props) {
    super(props);
    this._expansionStates = new Map();
    this.state = {
      rowBeingEdited: null,
    };
  }

  _getExpansionStateIdForExpression(expression: string): Object {
    let expansionStateId = this._expansionStates.get(expression);
    if (expansionStateId == null) {
      expansionStateId = {};
      this._expansionStates.set(expression, expansionStateId);
    }
    return expansionStateId;
  }

  removeExpression(index: number, event: MouseEvent): void {
    event.stopPropagation();
    this.props.onRemoveWatchExpression(index);
  }

  addExpression(expression: string): void {
    this.props.onAddWatchExpression(expression);
  }

  _onConfirmNewExpression = (): void => {
    const text = this.refs.newExpressionEditor.getText();
    this.addExpression(text);
    this.refs.newExpressionEditor.setText('');
  };

  _onConfirmExpressionEdit(index: number): void {
    const text = this.refs.editExpressionEditor.getText();
    this.props.onUpdateWatchExpression(index, text);
    this._resetExpressionEditState();
  }

  _setRowBeingEdited(index: number): void {
    this.setState({
      rowBeingEdited: index,
    });
    if (this.coreCancelDisposable) {
      this.coreCancelDisposable.dispose();
    }
    this.coreCancelDisposable = atom.commands.add('atom-workspace', {
      'core:cancel': () => this._resetExpressionEditState(),
    });
  }

  _resetExpressionEditState = (): void => {
    if (this.coreCancelDisposable) {
      this.coreCancelDisposable.dispose();
      this.coreCancelDisposable = null;
    }
    this.setState({rowBeingEdited: null});
  };

  _renderExpression = (
    fetchChildren: (objectId: string) => Observable<?ExpansionResult>,
    watchExpression: EvaluatedExpression,
    index: number,
  ): React.Element<any> => {
    const {expression, value} = watchExpression;
    if (index === this.state.rowBeingEdited) {
      return (
        <AtomInput
          className="nuclide-debugger-watch-expression-input"
          autofocus={true}
          startSelected={true}
          key={index}
          onConfirm={this._onConfirmExpressionEdit.bind(this, index)}
          onCancel={this._resetExpressionEditState}
          onBlur={this._resetExpressionEditState}
          ref="editExpressionEditor"
          size="sm"
          initialValue={expression}
        />
      );
    }
    const ValueComponent = bindObservableAsProps(
      value.map(v => ({evaluationResult: v})),
      LazyNestedValueComponent,
    );
    return (
      <div
        className={classnames(
          'nuclide-debugger-expression-value-row',
          'nuclide-debugger-watch-expression-row',
        )}
        key={index}>
        <div
          className={classnames(
            'nuclide-debugger-expression-value-content',
            'nuclide-debugger-watch-expression-value-content',
          )}
          onDoubleClick={this._setRowBeingEdited.bind(this, index)}>
          <ValueComponent
            expression={expression}
            fetchChildren={fetchChildren}
            simpleValueComponent={SimpleValueComponent}
            expansionStateId={this._getExpansionStateIdForExpression(
              expression,
            )}
          />
        </div>
        <div className="nuclide-debugger-watch-expression-controls">
          <Icon
            icon="pencil"
            className="nuclide-debugger-watch-expression-control"
            onClick={this._setRowBeingEdited.bind(this, index)}
          />
          <Icon
            icon="x"
            className="nuclide-debugger-watch-expression-control"
            onClick={this.removeExpression.bind(this, index)}
          />
        </div>
      </div>
    );
  };

  render(): React.Node {
    const {watchExpressions, watchExpressionStore} = this.props;
    const fetchChildren = watchExpressionStore.getProperties.bind(
      watchExpressionStore,
    );
    const expressions = watchExpressions.map(
      this._renderExpression.bind(this, fetchChildren),
    );
    const addNewExpressionInput = (
      <AtomInput
        className={classnames(
          'nuclide-debugger-watch-expression-input',
          'nuclide-debugger-watch-expression-add-new-input',
        )}
        onConfirm={this._onConfirmNewExpression}
        ref="newExpressionEditor"
        size="sm"
        placeholderText="Add new watch expression"
      />
    );
    return (
      <div className="nuclide-debugger-expression-value-list">
        {expressions}
        {addNewExpressionInput}
      </div>
    );
  }
}
