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

/**
 * A message view to be shown in Context View.
 */

import * as React from 'react';

export default class ContextViewMessage extends React.Component<{
  message: string | React.Element<any>,
}> {
  static NO_DEFINITION = 'No definition selected.';
  static LOADING = 'Loading...';
  static NOT_LOGGED_IN = (
    <div>
      <div>You need to log in to see this data!</div>
    </div>
  );

  render(): React.Node {
    return <div>{this.props.message}</div>;
  }
}
