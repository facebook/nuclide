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

import type {IEvaluatableExpression, IStackFrame, IProcess} from '../types';
import type {ExpressionTreeComponentProps} from './ExpressionTreeComponent';

import * as React from 'react';
import classnames from 'classnames';
import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import {bindObservableAsProps} from 'nuclide-commons-ui/bindObservableAsProps';
import nullthrows from 'nullthrows';
import invariant from 'assert';
import {Icon} from 'nuclide-commons-ui/Icon';
import {evaluateExpressionAsStream} from '../utils';
import {ExpressionTreeComponent} from './ExpressionTreeComponent';

type Props = {
  watchExpressions: Array<IEvaluatableExpression>,
  focusedStackFrame: ?IStackFrame,
  focusedProcess: ?IProcess,
  onAddWatchExpression: (expression: string) => void,
  onRemoveWatchExpression: (id: string) => void,
  onUpdateWatchExpression: (id: string, newExpression: string) => void,
};

type State = {
  rowBeingEdited: ?string,
};

export default class WatchExpressionComponent extends React.Component<
  Props,
  State,
> {
  coreCancelDisposable: ?IDisposable;
  _newExpressionEditor: ?AtomInput;
  _editExpressionEditor: ?AtomInput;
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

  removeExpression(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.props.onRemoveWatchExpression(id);
  }

  addExpression(expression: string): void {
    this.props.onAddWatchExpression(expression);
  }

  _onConfirmNewExpression = (): void => {
    const text = nullthrows(this._newExpressionEditor).getText();
    this.addExpression(text);
    nullthrows(this._newExpressionEditor).setText('');
  };

  _onConfirmExpressionEdit(id: string): void {
    const text = nullthrows(this._editExpressionEditor).getText();
    this.props.onUpdateWatchExpression(id, text);
    this._resetExpressionEditState();
  }

  _setRowBeingEdited(id: string): void {
    this.setState({
      rowBeingEdited: id,
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
    watchExpression: IEvaluatableExpression,
  ): React.Element<any> => {
    const {focusedProcess, focusedStackFrame} = this.props;
    const id = watchExpression.getId();
    const containerContext = this;
    if (id === this.state.rowBeingEdited) {
      return (
        <AtomInput
          className="debugger-watch-expression-input"
          autofocus={true}
          startSelected={true}
          key={id}
          onConfirm={this._onConfirmExpressionEdit.bind(this, id)}
          onCancel={this._resetExpressionEditState}
          onBlur={this._resetExpressionEditState}
          ref={input => {
            this._editExpressionEditor = input;
          }}
          size="sm"
          initialValue={watchExpression.name}
        />
      );
    }

    const ExpressionComponent =
      focusedProcess == null
        ? null
        : bindObservableAsProps(
            evaluateExpressionAsStream(
              watchExpression,
              focusedProcess,
              focusedStackFrame,
              'watch',
            ).map(result => {
              invariant(result != null);
              const props: ExpressionTreeComponentProps = {
                containerContext,
                pending: result.isPending,
                readOnly: true,
                expression:
                  result.isPending || result.isError
                    ? watchExpression
                    : result.value,
              };
              return props;
            }),
            ExpressionTreeComponent,
          );

    return (
      <div
        className={classnames(
          'debugger-expression-value-row',
          'debugger-watch-expression-row',
        )}
        key={id}>
        <div
          className={classnames(
            'debugger-expression-value-content',
            'debugger-watch-expression-value-content',
          )}
          onDoubleClick={this._setRowBeingEdited.bind(this, id)}>
          {ExpressionComponent == null ? (
            <span>
              {watchExpression.name}: Not available{' '}
              <i>(the debugger is not running)</i>.
            </span>
          ) : (
            <ExpressionComponent />
          )}
        </div>
        <div className="debugger-watch-expression-controls">
          <Icon
            icon="pencil"
            className="debugger-watch-expression-control"
            onClick={this._setRowBeingEdited.bind(this, id)}
          />
          <Icon
            icon="x"
            className="debugger-watch-expression-control"
            onClick={this.removeExpression.bind(this, id)}
          />
        </div>
      </div>
    );
  };

  render(): React.Node {
    const expressions = this.props.watchExpressions.map(this._renderExpression);
    const addNewExpressionInput = (
      <AtomInput
        className={classnames(
          'debugger-watch-expression-input',
          'debugger-watch-expression-add-new-input',
        )}
        onConfirm={this._onConfirmNewExpression}
        ref={input => {
          this._newExpressionEditor = input;
        }}
        size="sm"
        placeholderText="Add new watch expression"
      />
    );
    return (
      <div className="debugger-expression-value-list">
        {expressions}
        {addNewExpressionInput}
      </div>
    );
  }
}
