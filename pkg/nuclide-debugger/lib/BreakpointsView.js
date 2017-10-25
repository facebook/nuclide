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
import * as React from 'react';
import {BreakpointListComponent} from './BreakpointListComponent';

type Props = {
  model: DebuggerModel,
};

export class BreakpointsView extends React.PureComponent<Props> {
  constructor(props: Props) {
    super(props);
  }

  render(): React.Node {
    const {model} = this.props;
    const actions = model.getActions();

    return (
      <div
        className={classnames(
          'nuclide-debugger-container-new',
          'nuclide-debugger-breakpoint-list',
        )}>
        <div className="nuclide-debugger-pane-content ">
          <BreakpointListComponent
            actions={actions}
            breakpointStore={model.getBreakpointStore()}
          />
        </div>
      </div>
    );
  }
}
