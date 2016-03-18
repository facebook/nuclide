'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {FileTreeNodeData} from '../lib/FileTreeStore';

import FileTreeStore from '../lib/FileTreeStore';
import {React} from 'react-for-atom';
import RootNodeComponent from './RootNodeComponent';
import EmptyComponent from './EmptyComponent';
import {track} from '../../nuclide-analytics';
import {once} from '../../nuclide-commons';
import classnames from 'classnames';

type Props = {
  nodeToKeepInView: ?FileTreeNodeData;
};

class FileTree extends React.Component {
  props: Props;
  state: Object;
  _store: FileTreeStore;

  static trackFirstRender = once(() => {
    const rootKeysLength = FileTreeStore.getInstance().getRootKeys().length;
    // Wait using `setTimeout` and not `process.nextTick` or `setImmediate`
    // because those queue tasks in the current and next turn of the event loop
    // respectively. Since `setTimeout` gets preempted by them, it works great
    // for a more realistic "first render". Note: The scheduler for promises
    // (`Promise.resolve().then`) runs on the same queue as `process.nextTick`
    // but with a higher priority.
    setTimeout(() => {
      track('filetree-first-render', {
        'time-to-render': String(process.uptime() * 1000),
        'root-keys': String(rootKeysLength),
      });
    });
  });

  constructor(props: void) {
    super(props);
    this._store = FileTreeStore.getInstance();
  }

  componentDidMount(): void {
    FileTree.trackFirstRender(this);
  }

  componentDidUpdate(prevProps: Props, prevState: Object): void {
    if (prevProps.nodeToKeepInView != null) {
      /*
       * Scroll the node into view one final time after being reset to ensure final render is
       * complete before scrolling. Because the node is in `prevProps`, check for its existence
       * before scrolling it.
       */
      const refNode = this.refs[prevProps.nodeToKeepInView.rootKey];
      if (refNode != null) {
        refNode.scrollNodeIntoViewIfNeeded(prevProps.nodeToKeepInView.nodeKey);
      }
    }
  }

  render(): ReactElement {
    const classes = {
      'nuclide-file-tree': true,
      'focusable-panel': true,
      'tree-view': true,
      'nuclide-file-tree-editing-working-set': this._store.isEditingWorkingSet(),
    };

    return (
      <div className={classnames(classes)} tabIndex={0}>
        {this._renderChildren()}
      </div>
    );
  }

  _renderChildren(): ReactElement | Array<ReactElement> {
    const workingSet = this._store.getWorkingSet();
    const isEditingWorkingSet = this._store.isEditingWorkingSet();

    const rootKeys: Array<string> = FileTreeStore.getInstance().getRootKeys()
      .filter(rK =>  {
        if (workingSet == null || isEditingWorkingSet) {
          return true;
        }

        return workingSet.containsDir(rK);
      });
    if (rootKeys.length === 0) {
      return <EmptyComponent />;
    }
    return rootKeys.map((rootKey, index) => {
      return (
        <RootNodeComponent
          key={index.toString()}
          ref={rootKey}
          filter={this.props.filter}
          rootNode={FileTreeStore.getInstance().getRootNode(rootKey)}
          rootKey={rootKey}
        />
      );
    });
  }
}

module.exports = FileTree;
