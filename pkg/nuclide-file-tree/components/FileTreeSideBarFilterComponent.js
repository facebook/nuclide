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

import React from 'react';
import classnames from 'classnames';

type Props = {
  filter: string,
  found: boolean,
};

export default class FileTreeSidebarFilterComponent extends React.Component {
  props: Props;

  render() {
    const {filter, found} = this.props;

    const classes = classnames({
      'nuclide-file-tree-filter': true,
      show: Boolean(filter && filter.length),
      'not-found': !found,
    });
    const text = `search for: ${filter}`;

    return (
      <div className={classes}>
        {text}
      </div>
    );
  }
}
