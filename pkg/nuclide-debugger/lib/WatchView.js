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
import {WatchExpressionComponent} from './WatchExpressionComponent';

type Props = {
  model: DebuggerModel,
};

export class WatchView extends React.PureComponent<Props> {
  _watchExpressionComponentWrapped: React.ComponentType<any>;
  _disposables: UniversalDisposable;

  constructor(props: Props) {
    super(props);
    this._watchExpressionComponentWrapped = bindObservableAsProps(
      props.model
        .getWatchExpressionListStore()
        .getWatchExpressions()
        .map(watchExpressions => ({watchExpressions})),
      WatchExpressionComponent,
    );
  }

  render(): React.Node {
    const {model} = this.props;
    const actions = model.getActions();
    const WatchExpressionComponentWrapped = this
      ._watchExpressionComponentWrapped;

    return (
      <div className={classnames('nuclide-debugger-container-new')}>
        <div className="nuclide-debugger-pane-content">
          <WatchExpressionComponentWrapped
            onAddWatchExpression={actions.addWatchExpression.bind(model)}
            onRemoveWatchExpression={actions.removeWatchExpression.bind(model)}
            onUpdateWatchExpression={actions.updateWatchExpression.bind(model)}
            watchExpressionStore={model.getWatchExpressionStore()}
          />
        </div>
      </div>
    );
  }
}
