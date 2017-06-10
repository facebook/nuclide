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
import {DebuggerThreadsComponent} from './DebuggerThreadsComponent';
import type {ThreadColumn} from '../../nuclide-debugger-base/lib/types';
import type {DebuggerModeType} from './types';
import {DebuggerMode} from './DebuggerStore';

type Props = {
  model: DebuggerModel,
};

export class ThreadsView extends React.PureComponent {
  props: Props;
  state: {
    customThreadColumns: Array<ThreadColumn>,
    mode: DebuggerModeType,
    threadsComponentTitle: string,
  };
  _disposables: CompositeDisposable;

  constructor(props: Props) {
    super(props);
    this._disposables = new CompositeDisposable();
    const debuggerStore = props.model.getStore();
    this.state = {
      customThreadColumns: (debuggerStore
        .getSettings()
        .get('CustomThreadColumns'): any) || [],
      mode: debuggerStore.getDebuggerMode(),
      threadsComponentTitle: String(
        debuggerStore.getSettings().get('threadsComponentTitle'),
      ),
    };
  }

  componentDidMount(): void {
    const debuggerStore = this.props.model.getStore();
    this._disposables.add(
      debuggerStore.onChange(() => {
        this.setState({
          customThreadColumns: (debuggerStore
            .getSettings()
            .get('CustomThreadColumns'): any) || [],
          mode: debuggerStore.getDebuggerMode(),
          threadsComponentTitle: String(
            debuggerStore.getSettings().get('threadsComponentTitle'),
          ),
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
    const {mode, threadsComponentTitle, customThreadColumns} = this.state;
    const disabledClass = mode !== DebuggerMode.RUNNING
      ? ''
      : ' nuclide-debugger-container-new-disabled';

    return (
      <div
        className={classnames('nuclide-debugger-container-new', disabledClass)}>
        <div className="nuclide-debugger-pane-content">
          <DebuggerThreadsComponent
            bridge={this.props.model.getBridge()}
            threadStore={model.getThreadStore()}
            customThreadColumns={customThreadColumns}
            threadName={threadsComponentTitle}
          />
        </div>
      </div>
    );
  }
}
