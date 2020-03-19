/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */
/* global Element */

import {Provider} from 'react-redux';
import {FileTreeNode} from '../lib/FileTreeNode';
import FileTreeEntryComponent from '../components/FileTreeEntryComponent';
import invariant from 'assert';
import * as React from 'react';
import ReactDOM from 'react-dom';
import TestUtils from 'react-dom/test-utils';
import createStore from '../lib/redux/createStore';
import * as Selectors from '../lib/redux/Selectors';
import * as Actions from '../lib/redux/Actions';

function renderEntryComponentIntoDocument(
  Component: Object,
  store,
  props: Object = {},
  conf: Object = {},
): React.Component<any, any> {
  const nodeProps = {
    isExpanded: false,
    isLoading: false,
    isCwd: false,
    ...props,
  };

  const node = new FileTreeNode(nodeProps);

  store.dispatch(Actions.focus(node));
  const selectedNodes = Selectors.getSelectedNodes(store.getState()).toSet();

  return TestUtils.renderIntoDocument(
    /* $FlowFixMe(>=0.86.0) This
     * comment suppresses an error found when Flow v0.86 was
     * deployed. To see the error, delete this comment and
     * run Flow. */
    <Provider store={store}>
      <Component node={node} {...props} selectedNodes={selectedNodes} />
    </Provider>,
  );
}

let store;
beforeEach(() => {
  store = createStore();
  jest.spyOn(store, 'dispatch');
});

describe('Directory FileTreeEntryComponent', () => {
  describe('when expanding/collapsing dir component', () => {
    // TODO: This implementation changed. We need to update the test accordingly.
    it.skip('expands on click when node is selected', () => {
      const props = {rootUri: '/a/', uri: '/a/b/', isContainer: true};
      store.dispatch(Actions.setSelectedNode(props.rootUri, props.uri));
      const nodeComponent = renderEntryComponentIntoDocument(
        FileTreeEntryComponent,
        store,
        props,
      );

      // The onClick is listened not by the <li> element, but by its first child.
      // $FlowFixMe
      const domNode = ReactDOM.findDOMNode(nodeComponent).children[0];
      TestUtils.Simulate.click(domNode);
      expect(store.dispatch.mock.calls.map(call => call[0].type)).toContain(
        Actions.EXPAND_NODE,
      );
    });
  });
});

describe('File FileTreeEntryComponent', () => {
  describe('when expanding/collapsing file component', () => {
    it('does not expand on click when node is selected', () => {
      const props = {rootUri: '/a/', uri: '/a/b', isContainer: false};
      store.dispatch(Actions.setSelectedNode(props.rootUri, props.uri));
      const nodeComponent = renderEntryComponentIntoDocument(
        FileTreeEntryComponent,
        store,
        props,
      );
      const domNode = ReactDOM.findDOMNode(nodeComponent);
      invariant(domNode instanceof Element);
      TestUtils.Simulate.click(domNode);
      expect(store.dispatch.mock.calls.map(call => call[0].type)).not.toContain(
        Actions.EXPAND_NODE,
      );
    });
  });

  describe('when preview tabs are enabled', () => {
    it('opens a file if a selected node is clicked', () => {
      const props = {rootUri: '/a/', uri: '/a/b', isContainer: false};
      store.dispatch(Actions.setUsePreviewTabs(true));
      store.dispatch(Actions.setSelectedNode(props.rootUri, props.uri));

      const nodeComponent = renderEntryComponentIntoDocument(
        FileTreeEntryComponent,
        store,
        props,
      );
      const domNode = ReactDOM.findDOMNode(nodeComponent);
      invariant(domNode instanceof Element);
      TestUtils.Simulate.click(domNode);
      expect(store.dispatch.mock.calls.map(call => call[0].type)).toContain(
        Actions.CONFIRM_NODE,
      );
    });
  });
});
