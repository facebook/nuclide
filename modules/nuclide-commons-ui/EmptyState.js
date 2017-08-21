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

import React from 'react';

type Props = {
  title: string,
  message: string,
};

export class EmptyState extends React.Component {
  props: Props;

  render(): React.Element<any> {
    return (
      <div className="nuclide-ui-empty-state-container">
        <div className="nuclide-ui-empty-state-message">
          <h1>
            {this.props.title}
          </h1>
          {this.props.message}
        </div>
      </div>
    );
  }
}
