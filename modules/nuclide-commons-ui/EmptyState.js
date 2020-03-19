/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict
 * @format
 */

import * as React from 'react';

type Props = {
  title: string,
  message: React$Node,
};

export class EmptyState extends React.Component<Props> {
  render(): React.Node {
    return (
      <div className="nuclide-ui-empty-state-container">
        <div className="nuclide-ui-empty-state-message">
          <h1>{this.props.title}</h1>
          {this.props.message}
        </div>
      </div>
    );
  }
}
