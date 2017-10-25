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

import * as React from 'react';

type Props = {
  title: string,
  iconName: string,
  component: React.ComponentType<any>,
};

export default class VcsLogGadget extends React.Component<Props> {
  getTitle(): string {
    return this.props.title;
  }

  getIconName(): string {
    return this.props.iconName;
  }

  render(): React.Node {
    const {component: Component} = this.props;
    return <Component />;
  }
}
