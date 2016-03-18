'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import {
  React,
  ReactDOM,
} from 'react-for-atom';
import FileTree from './FileTree';
import {FileTreeToolbarComponent} from './FileTreeToolbarComponent';
import FileTreeStore from '../lib/FileTreeStore';
import {CompositeDisposable} from 'atom';

class FileTreeSidebarFilterComponent extends React.Component {
  render() {
    const classes = ['nuclide-file-tree-filter'];
    if (this.props.filter && this.props.filter.length) {
      classes.push('show');
    }
    if (!this.props.found) {
      classes.push('not-found');
    }
    const text = `search for: ${this.props.filter || ''}`;

    return (
      <div className={classes.join(' ')}>{text}</div>
    );
  }
}

module.exports = FileTreeSidebarFilterComponent;
