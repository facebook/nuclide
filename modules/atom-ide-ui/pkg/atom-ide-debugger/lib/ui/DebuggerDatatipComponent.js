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

import type {Expected} from 'nuclide-commons/expected';
import type {IExpression} from '../types';

import {LoadingSpinner} from 'nuclide-commons-ui/LoadingSpinner';
import * as React from 'react';
import {ExpressionTreeComponent} from './ExpressionTreeComponent';

type Props = {|
  +expression: Expected<IExpression>,
|};

export default class DebuggerDatatipComponent extends React.Component<Props> {
  render(): React.Node {
    const {expression} = this.props;
    if (expression.isPending) {
      return <LoadingSpinner delay={100} size="EXTRA_SMALL" />;
    } else if (expression.isError) {
      return null;
    } else {
      return (
        <div className="debugger-datatip">
          <span className="debugger-datatip-value">
            <ExpressionTreeComponent
              expression={expression.value}
              containerContext={this}
            />
          </span>
        </div>
      );
    }
  }
}
