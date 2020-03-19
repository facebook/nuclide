/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import type {IDebugService} from '../types';

import classnames from 'classnames';
import * as React from 'react';
import BreakpointListComponent from './BreakpointListComponent';

type Props = {
  service: IDebugService,
};

export default class BreakpointsView extends React.PureComponent<Props> {
  render(): React.Node {
    const {service} = this.props;

    return (
      <div
        className={classnames(
          'debugger-container-new',
          'debugger-breakpoint-list',
        )}>
        <div className="debugger-pane-content ">
          <BreakpointListComponent service={service} />
        </div>
      </div>
    );
  }
}
