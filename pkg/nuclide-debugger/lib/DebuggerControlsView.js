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

import type DebuggerModel from './DebuggerModel';
import {CompositeDisposable} from 'atom';
import React from 'react';
import TruncatedButton from 'nuclide-commons-ui/TruncatedButton';
import {DebuggerSteppingComponent} from './DebuggerSteppingComponent';
import type {DebuggerModeType} from './types';
import {DebuggerMode} from './DebuggerStore';
import DebuggerControllerView from './DebuggerControllerView';

type Props = {
  model: DebuggerModel,
};

export class DebuggerControlsView extends React.PureComponent {
  props: Props;
  state: {
    mode: DebuggerModeType,
  };
  _disposables: CompositeDisposable;

  constructor(props: Props) {
    super(props);

    (this: any)._openDevTools = this._openDevTools.bind(this);
    (this: any)._stopDebugging = this._stopDebugging.bind(this);

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
    const debuggerStoppedNotice = mode !== DebuggerMode.STOPPED
      ? null
      : <div className="nuclide-debugger-pane-content">
          <div className="nuclide-debugger-state-notice">
            <span>The debugger is not attached.</span>
            <div className="padded">
              <TruncatedButton
                onClick={() =>
                  atom.commands.dispatch(
                    atom.views.getView(atom.workspace),
                    'nuclide-debugger:show-attach-dialog',
                  )}
                icon="nuclicon-debugger"
                label="Attach debugger..."
              />
              <TruncatedButton
                onClick={() =>
                  atom.commands.dispatch(
                    atom.views.getView(atom.workspace),
                    'nuclide-debugger:show-launch-dialog',
                  )}
                icon="nuclicon-debugger"
                label="Launch debugger..."
              />
            </div>
          </div>
        </div>;

    const debugeeRunningNotice = mode !== DebuggerMode.RUNNING
      ? null
      : <div className="nuclide-debugger-pane-content">
          <div className="nuclide-debugger-state-notice">
            The debug target is currently running.
          </div>
        </div>;

    return (
      <div className="nuclide-debugger-container-new">
        <div className="nuclide-debugger-section-header">
          <DebuggerControllerView
            store={model.getStore()}
            bridge={model.getBridge()}
            breakpointStore={model.getBreakpointStore()}
            openDevTools={this._openDevTools}
            stopDebugging={this._stopDebugging}
          />
        </div>
        <div className="nuclide-debugger-section-header nuclide-debugger-controls-section">
          <DebuggerSteppingComponent
            actions={actions}
            debuggerStore={model.getStore()}
          />
        </div>
        {debugeeRunningNotice}
        {debuggerStoppedNotice}
      </div>
    );
  }

  _openDevTools(): void {
    const {model} = this.props;
    model.getActions().openDevTools();
  }

  _stopDebugging(): void {
    const {model} = this.props;
    model.getActions().stopDebugging();
  }
}
