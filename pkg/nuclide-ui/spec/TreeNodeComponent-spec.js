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

import {LazyTestTreeNode} from './LazyTestTreeNode';
import React from 'react';
import ReactDOM from 'react-dom';
import TestUtils from 'react-addons-test-utils';
import {TreeNodeComponent} from '../TreeNodeComponent';
import invariant from 'assert';

describe('TreeNodeComponent', () => {
  let props;
  let treeNodeComponent;

  const iconClassName = 'icon-file-text';
  const label = 'file.js';

  beforeEach(() => {
    props = {
      depth: 0,
      isContainer: false,
      isExpanded: false,
      isLoading: false,
      isSelected: false,
      label,
      labelClassName: iconClassName,
      node: new LazyTestTreeNode({label}, null, false, null),
      onClick: () => {},
      onClickArrow: () => {},
      onDoubleClick: () => {},
      onMouseDown: () => {},
      path: '',
      rowClassName: '',
    };

    spyOn(props, 'onClick');
    spyOn(props, 'onClickArrow');
    spyOn(props, 'onDoubleClick');

    treeNodeComponent = TestUtils.renderIntoDocument(
      <TreeNodeComponent {...props} />,
    );
  });

  describe('rendering its icons', () => {
    // The package expects icons to have a `data-name` attribute with the name
    // of the file and for the list item in the tree to have the class names
    // 'entry', 'file', and 'list-item'.
    //
    // See: https://atom.io/packages/file-icons
    it('uses selectors necessary for the "file-icons" package', () => {
      const domNode = ReactDOM.findDOMNode(treeNodeComponent);

      // $FlowFixMe
      expect(domNode.classList.contains('entry')).toBe(true);
      // $FlowFixMe
      expect(domNode.classList.contains('file')).toBe(true);
      // $FlowFixMe
      expect(domNode.classList.contains('list-item')).toBe(true);

      const iconComponent = TestUtils.findRenderedDOMComponentWithClass(
        treeNodeComponent,
        iconClassName,
      );

      // $FlowFixMe
      expect(ReactDOM.findDOMNode(iconComponent).dataset.name).toEqual(label);
    });
  });

  describe('clicking a node', () => {
    it('calls its `onClick` callback', () => {
      const domNode = ReactDOM.findDOMNode(treeNodeComponent);

      TestUtils.Simulate.click(domNode);
      invariant(props);
      expect(props.onClick).toHaveBeenCalled();
    });
  });

  describe("clicking a node's arrow", () => {
    it('calls its `onClickArrow` callback, not its `onClick` callback', () => {
      const arrow = TestUtils.findRenderedDOMComponentWithClass(
        treeNodeComponent,
        'nuclide-tree-component-item-arrow',
      );

      TestUtils.Simulate.click(arrow);
      invariant(props);
      expect(props.onClick).not.toHaveBeenCalled();
      expect(props.onClickArrow).toHaveBeenCalled();
    });
  });

  describe('double clicking a node', () => {
    it('calls its `onDoubleClick` callback', () => {
      const domNode = ReactDOM.findDOMNode(treeNodeComponent);

      TestUtils.Simulate.doubleClick(domNode);
      invariant(props);
      expect(props.onDoubleClick).toHaveBeenCalled();
    });
  });
});
