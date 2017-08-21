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

import type {FileLineBreakpoint} from './types';

import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import DebuggerActions from './DebuggerActions';
import React from 'react';
import {Button, ButtonTypes} from 'nuclide-commons-ui/Button';
import {ButtonGroup} from 'nuclide-commons-ui/ButtonGroup';
import nuclideUri from 'nuclide-commons/nuclideUri';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Checkbox} from 'nuclide-commons-ui/Checkbox';
import BreakpointStore from './BreakpointStore';
import {Modal} from '../../nuclide-ui/Modal';
import {track} from '../../nuclide-analytics';
import invariant from 'invariant';

type PropsType = {
  onDismiss: () => void,
  breakpoint: FileLineBreakpoint,
  actions: DebuggerActions,
  breakpointStore: BreakpointStore,
};

type StateType = {
  breakpoint: FileLineBreakpoint,
};

export class BreakpointConfigComponent extends React.Component<
  void,
  PropsType,
  StateType,
> {
  props: PropsType;
  state: StateType;
  _disposables: UniversalDisposable;

  constructor(props: PropsType) {
    super(props);
    this._disposables = new UniversalDisposable();
    this.state = {
      breakpoint: this.props.breakpoint,
    };

    this._disposables.add(
      this.props.breakpointStore.onNeedUIUpdate(() => {
        const breakpoint = this.props.breakpointStore.getBreakpointAtLine(
          this.state.breakpoint.path,
          this.state.breakpoint.line,
        );
        if (breakpoint == null) {
          // Breakpoint no longer exists.
          this.props.onDismiss();
        }
        invariant(breakpoint != null);
        this.setState({breakpoint});
      }),
    );
  }

  componentDidMount(): void {
    track('nuclide-debugger-breakpoint-condition-shown', {
      fileExtension: nuclideUri.extname(this.props.breakpoint.path),
    });
    this._disposables.add(
      atom.commands.add(window, 'core:cancel', this.props.onDismiss),
      atom.commands.add(window, 'core:confirm', this._updateBreakpoint),
    );
  }

  componentWillUnmount(): void {
    this._disposables.dispose();
  }

  _updateBreakpoint = () => {
    const condition = this.refs.condition.getText().trim();
    this.props.actions.updateBreakpointCondition(
      this.state.breakpoint.id,
      condition,
    );
    track('nuclide-debugger-breakpoint-condition-saved', {
      path: this.props.breakpoint.path,
      line: this.props.breakpoint.line,
      condition,
      fileExtension: nuclideUri.extname(this.props.breakpoint.path),
    });
    this.props.onDismiss();
  };

  render(): React.Element<any> {
    return (
      <Modal onDismiss={() => this.props.onDismiss()}>
        <div className="padded nuclide-debugger-bp-dialog">
          <h1 className="nuclide-debugger-bp-config-header">Edit breakpoint</h1>
          <div className="block">
            <label>
              Breakpoint at {nuclideUri.basename(this.state.breakpoint.path)}
              :
              {this.state.breakpoint.line}
            </label>
          </div>
          <div className="block">
            <Checkbox
              onChange={isChecked =>
                this.props.actions.updateBreakpointEnabled(
                  this.state.breakpoint.id,
                  isChecked,
                )}
              checked={this.state.breakpoint.enabled}
              label="Enable breakpoint"
            />
          </div>
          <div className="block">
            <AtomInput
              placeholderText="Breakpoint hit condition..."
              value={this.state.breakpoint.condition}
              size="sm"
              ref="condition"
              autofocus={true}
            />
          </div>
          <label>
            This expression will be evaluated each time the corresponding line
            is hit, but the debugger will only break execution if the expression
            evaluates to true.
          </label>
          <div className="nuclide-debugger-bp-config-actions">
            <ButtonGroup>
              <Button onClick={this.props.onDismiss}>Cancel</Button>
              <Button
                buttonType={ButtonTypes.PRIMARY}
                onClick={this._updateBreakpoint}>
                Update
              </Button>
            </ButtonGroup>
          </div>
        </div>
      </Modal>
    );
  }
}
