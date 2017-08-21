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

import classnames from 'classnames';
import type DebuggerModel from './DebuggerModel';
import {CompositeDisposable} from 'atom';
import React from 'react';
import {DebuggerCallstackComponent} from './DebuggerCallstackComponent';
import type {DebuggerModeType} from './types';
import {DebuggerMode} from './DebuggerStore';

type Props = {
  model: DebuggerModel,
};

export class CallstackView extends React.PureComponent {
  props: Props;
  state: {
    mode: DebuggerModeType,
  };
  _disposables: CompositeDisposable;

  constructor(props: Props) {
    super(props);
    this._disposables = new CompositeDisposable();
    const debuggerStore = props.model.getStore();
    this.state = {
      mode: debuggerStore.getDebuggerMode(),
    };
  }

  componentDidMount(): void {
    const debuggerStore = this.props.model.getStore();
    this._disposables.add(
      debuggerStore.onChange(() => {
        this.setState({
          mode: debuggerStore.getDebuggerMode(),
        });
      }),
    );
  }

  componentWillUnmount(): void {
    this._dispose();
  }

  _dispose(): void {
    this._disposables.dispose();
  }

  render(): React.Element<any> {
    const {model} = this.props;
    const actions = model.getActions();
    const {mode} = this.state;
    const disabledClass =
      mode !== DebuggerMode.RUNNING
        ? ''
        : ' nuclide-debugger-container-new-disabled';

    return (
      <div
        className={classnames('nuclide-debugger-container-new', disabledClass)}>
        <div className="nuclide-debugger-pane-content">
          <DebuggerCallstackComponent
            actions={actions}
            bridge={model.getBridge()}
            callstackStore={model.getCallstackStore()}
          />
        </div>
      </div>
    );
  }
}
