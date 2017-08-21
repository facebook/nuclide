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

import type {LazyTreeNode} from '../../../nuclide-ui/LazyTreeNode';
import type TestSuiteModel from '../TestSuiteModel';

import React from 'react';
import {PanelComponentScroller} from 'nuclide-commons-ui/PanelComponentScroller';
import TestClassTreeNode from './TestClassTreeNode';
import {TreeRootComponent} from '../../../nuclide-ui/TreeRootComponent';

function labelClassNameForNode(): string {
  return 'icon icon-code';
}

type Props = {
  isRunning: boolean,
  testSuiteModel: ?TestSuiteModel,
};

export default class TestClassTree extends React.Component {
  props: Props;

  componentDidUpdate(prevProps: Object) {
    const {testSuiteModel} = this.props;
    if (testSuiteModel !== prevProps.testSuiteModel) {
      const roots = [];
      if (testSuiteModel) {
        for (const testClass of testSuiteModel.testClasses.values()) {
          roots.push(new TestClassTreeNode(testClass));
        }
      }
      this.refs.tree.setRoots(roots);
    }

    (this: any).rowClassNameForNode = this.rowClassNameForNode.bind(this);
  }

  render() {
    const emptyRenderMessage = (
      <div>
        <h5>Running tests</h5>
        <ol>
          <li>Open the file you want to test</li>
          <li>Choose the appropriate runner from the dropdown</li>
          <li>
            {'Click "Test" to run tests for that file\'s directory'}
          </li>
        </ol>
      </div>
    );

    return (
      <PanelComponentScroller>
        <div className="padded">
          <TreeRootComponent
            elementToRenderWhenEmpty={emptyRenderMessage}
            eventHandlerSelector=".nuclide-test-runner-tree"
            initialRoots={[]}
            labelClassNameForNode={labelClassNameForNode}
            onKeepSelection={() => {}}
            ref="tree"
            rowClassNameForNode={this.rowClassNameForNode}
          />
        </div>
      </PanelComponentScroller>
    );
  }

  rowClassNameForNode(node: LazyTreeNode): string {
    const {testSuiteModel} = this.props;
    if (!testSuiteModel) {
      return '';
    }

    const item = node.getItem();
    const testRun = testSuiteModel.testRuns.get(item.id);
    if (testRun) {
      if (testRun.numFailures > 0) {
        // Red/error if the test class had errors.
        return 'status-removed';
      } else if (testRun.numSkipped > 0) {
        // Yellow/warning if the class skipped tests.
        return 'status-modified';
      } else {
        // Green/success if all tests passed without skipping any.
        return 'status-added';
      }
    } else if (!this.props.isRunning) {
      return 'status-ignored';
    }

    return '';
  }
}
