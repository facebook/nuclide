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

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import * as React from 'react';
import {bindObservableAsProps} from 'nuclide-commons-ui/bindObservableAsProps';
import {ScopesComponent} from './ScopesComponent';
import type {DebuggerModeType} from './types';
import {DebuggerMode} from './DebuggerStore';

type Props = {
  model: DebuggerModel,
};
type State = {
  mode: DebuggerModeType,
};

export class ScopesView extends React.PureComponent<Props, State> {
  _scopesComponentWrapped: React.ComponentType<any>;
  _disposables: UniversalDisposable;

  constructor(props: Props) {
    super(props);
    this._scopesComponentWrapped = bindObservableAsProps(
      props.model
        .getScopesStore()
        .getScopes()
        .map(scopes => ({scopes})),
      ScopesComponent,
    );
    this._disposables = new UniversalDisposable();
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

  render(): React.Node {
    const {model} = this.props;
    const {mode} = this.state;
    const ScopesComponentWrapped = this._scopesComponentWrapped;
    const disabledClass =
      mode !== DebuggerMode.RUNNING
        ? ''
        : ' nuclide-debugger-container-new-disabled';

    return (
      <div
        className={classnames('nuclide-debugger-container-new', disabledClass)}>
        <div className="nuclide-debugger-pane-content">
          <ScopesComponentWrapped
            watchExpressionStore={model.getWatchExpressionStore()}
            scopesStore={model.getScopesStore()}
          />
        </div>
      </div>
    );
  }
}
