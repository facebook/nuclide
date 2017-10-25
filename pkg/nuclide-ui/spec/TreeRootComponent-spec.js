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

/* global Element */

import type {LazyTreeNode} from '../LazyTreeNode';

import {LazyTestTreeNode} from './LazyTestTreeNode';
import * as React from 'react';
import ReactDOM from 'react-dom';
import TestUtils from 'react-dom/test-utils';
import {TreeNodeComponent} from '../TreeNodeComponent';
import {TreeRootComponent} from '../TreeRootComponent';
import invariant from 'assert';

function clickNodeWithLabel(component: TreeRootComponent, label: string): void {
  const nodeComponents = getNodeComponents(component);
  const labelNode = ReactDOM.findDOMNode(nodeComponents[label]);
  invariant(labelNode instanceof Element);
  TestUtils.Simulate.click(labelNode);
}

/**
 * Returns an object whose keys are labels and values are TreeNodeComponent's.
 */
function getNodeComponents(component: TreeRootComponent): any {
  const nodeComponents = {};
  TestUtils.scryRenderedComponentsWithType(
    component,
    TreeNodeComponent,
  ).forEach(nodeComponent => {
    const label = nodeComponent.props.node.getItem().label;
    nodeComponents[label] = nodeComponent;
  });
  return nodeComponents;
}

describe('TreeRootComponent', () => {
  // Use `renderComponent` in `beforeEach` to return the component so the test
  // methods have a chance to modify the default props.
  let renderComponent: ?(props: any) => TreeRootComponent;
  let props;
  let hostEl;
  let nodes: {[key: string]: LazyTreeNode} = {};

  beforeEach(() => {
    nodes = {};

    //   A
    //  / \
    // B   C
    nodes.A = new LazyTestTreeNode(
      {label: 'A'},
      /* parent */ null,
      true,
      async () => [nodes.B, nodes.C],
    );
    nodes.B = new LazyTestTreeNode(
      {label: 'B'},
      /* parent */ nodes.A,
      false,
      async () => null,
    );
    nodes.C = new LazyTestTreeNode(
      {label: 'C'},
      /* parent */ nodes.A,
      false,
      async () => null,
    );

    //   D
    //  / \
    // E   F
    nodes.D = new LazyTestTreeNode(
      {label: 'D'},
      /* parent */ null,
      true,
      async () => [nodes.E, nodes.F],
    );
    nodes.E = new LazyTestTreeNode(
      {label: 'E'},
      /* parent */ nodes.D,
      false,
      async () => null,
    );
    nodes.F = new LazyTestTreeNode(
      {label: 'F'},
      /* parent */ nodes.D,
      false,
      async () => null,
    );

    //      G
    //     / \
    //    H   I
    //  /   /   \
    // J   K     H(2)
    nodes.G = new LazyTestTreeNode(
      {label: 'G'},
      /* parent */ null,
      true,
      async () => [nodes.H, nodes.I],
    );
    nodes.H = new LazyTestTreeNode(
      {label: 'H'},
      /* parent */ nodes.G,
      true,
      async () => [nodes.J],
    );
    nodes.I = new LazyTestTreeNode(
      {label: 'I'},
      /* parent */ nodes.G,
      true,
      async () => [nodes.K, nodes.H2],
    );
    nodes.J = new LazyTestTreeNode(
      {label: 'J'},
      /* parent */ nodes.H,
      false,
      async () => null,
    );
    nodes.K = new LazyTestTreeNode(
      {label: 'K'},
      /* parent */ nodes.I,
      false,
      async () => null,
    );
    nodes.H2 = new LazyTestTreeNode(
      {label: 'H'},
      /* parent */ nodes.I,
      false,
      async () => null,
    );

    hostEl = document.createElement('div');
    hostEl.className = 'test';
    renderComponent = componentProps => {
      const component = ReactDOM.render(
        <TreeRootComponent {...componentProps} />,
        hostEl,
      );
      invariant(component instanceof TreeRootComponent);
      return component;
    };

    props = {
      initialRoots: [],
      eventHandlerSelector: '.test',
      labelClassNameForNode: node => node.getItem().label,
      onKeepSelection() {},
      rowClassNameForNode: node => '',
      onConfirmSelection: () => {},
    };
  });

  describe('setRoots', () => {
    it('preserves state for reusable roots + removes state for non-reusable roots', () => {
      waitsForPromise(async () => {
        invariant(renderComponent);
        const component = renderComponent(props);
        await component.setRoots([nodes.A]);
        await component.setRoots([nodes.G, nodes.A]);

        expect(component.getRootNodes()).toEqual([nodes.G, nodes.A]);
        expect(component.getSelectedNodes()).toEqual([]);
        const expandedNodeKeys = component
          .getExpandedNodes()
          .map(node => node.getKey());
        expect(expandedNodeKeys).toEqual([nodes.G.getKey(), nodes.A.getKey()]);
      });
    });

    it('returns a Promise that resolves after the children are rendered', () => {
      waitsForPromise(async () => {
        invariant(renderComponent);
        const component = renderComponent(props);

        // The children should be in the tree if we `await` the promise.
        await component.setRoots([nodes.D]);
        let nodeComponents = getNodeComponents(component);
        expect(nodeComponents.E).not.toBeUndefined();

        // The children shouldn't immediately be in the tree if we don't
        // `await` the promise.
        component.setRoots([nodes.A]);
        nodeComponents = getNodeComponents(component);
        expect(nodeComponents.B).toBeUndefined();
      });
    });

    it('rejects outdated promises', () => {
      waitsForPromise(async () => {
        invariant(renderComponent);
        const component = renderComponent(props);

        const setRootsPromise1 = component.setRoots([nodes.A]);
        const setRootsPromise2 = component.setRoots([nodes.D]);
        await setRootsPromise2;
        let isRejected = false;
        try {
          await setRootsPromise1;
        } catch (error) {
          isRejected = true;
        }
        expect(isRejected).toBe(true);
        const nodeComponents = getNodeComponents(component);
        expect(nodeComponents.B).toBeUndefined();
        expect(nodeComponents.E).not.toBeUndefined();
      });
    });
  });

  describe('invalidateCachedNodes', () => {
    it('invalidates the cached nodes', () => {
      waitsForPromise(async () => {
        invariant(renderComponent);
        const component = renderComponent(props);
        await component.setRoots([nodes.G, nodes.A]);

        expect(nodes.G.isCacheValid()).toBe(true);
        expect(nodes.A.isCacheValid()).toBe(true);

        component.invalidateCachedNodes();

        expect(nodes.G.isCacheValid()).toBe(false);
        expect(nodes.A.isCacheValid()).toBe(false);
      });
    });
  });

  describe('handling core:move-left', () => {
    it('moves the selection to the parent when collapsing a non-container node', () => {
      waitsForPromise(async () => {
        invariant(renderComponent);
        const component = renderComponent(props);
        await component.setRoots([nodes.A]);

        clickNodeWithLabel(component, 'B');
        expect(component.getSelectedNodes()).toEqual([nodes.B]);

        invariant(hostEl);
        atom.commands.dispatch(hostEl, 'core:move-left');
        expect(component.getSelectedNodes()).toEqual([nodes.A]);
        expect(component.getExpandedNodes()).toEqual([nodes.A]);
      });
    });

    it('moves selection to the parent when collapsing an already-collapsed container node', () => {
      waitsForPromise(async () => {
        invariant(renderComponent);
        const component = renderComponent(props);
        await component.setRoots([nodes.G]);

        clickNodeWithLabel(component, 'H');
        expect(component.getSelectedNodes()).toEqual([nodes.H]);
        expect(component.getExpandedNodes()).toEqual([nodes.G]);

        invariant(hostEl);
        atom.commands.dispatch(hostEl, 'core:move-left');
        expect(component.getSelectedNodes()).toEqual([nodes.G]);
        expect(component.getExpandedNodes()).toEqual([nodes.G]);
      });
    });

    it('collapses the selection when collapsing an expanded container node', () => {
      waitsForPromise(async () => {
        invariant(renderComponent);
        const component = renderComponent(props);
        await component.setRoots([nodes.G]);

        clickNodeWithLabel(component, 'H');
        invariant(hostEl);
        atom.commands.dispatch(hostEl, 'core:move-right');
        expect(component.getSelectedNodes()).toEqual([nodes.H]);
        expect(component.getExpandedNodes()).toEqual([nodes.G, nodes.H]);

        atom.commands.dispatch(hostEl, 'core:move-left');
        expect(component.getSelectedNodes()).toEqual([nodes.H]);
        expect(component.getExpandedNodes()).toEqual([nodes.G]);
      });
    });

    it('does nothing when collapsing an already-collapsed root element', () => {
      waitsForPromise(async () => {
        invariant(renderComponent);
        const component = renderComponent(props);
        await component.setRoots([nodes.G]);

        clickNodeWithLabel(component, 'G');
        expect(component.getSelectedNodes()).toEqual([nodes.G]);
        invariant(hostEl);
        atom.commands.dispatch(hostEl, 'core:move-left');
        expect(component.getExpandedNodes()).toEqual([]);

        atom.commands.dispatch(hostEl, 'core:move-left');
        expect(component.getSelectedNodes()).toEqual([nodes.G]);
        expect(component.getExpandedNodes()).toEqual([]);
      });
    });

    it('collapses the selection when collapsing an expanded root element', () => {
      waitsForPromise(async () => {
        invariant(renderComponent);
        const component = renderComponent(props);
        await component.setRoots([nodes.G]);

        clickNodeWithLabel(component, 'G');
        expect(component.getSelectedNodes()).toEqual([nodes.G]);
        expect(component.getExpandedNodes()).toEqual([nodes.G]);

        invariant(hostEl);
        atom.commands.dispatch(hostEl, 'core:move-left');
        expect(component.getSelectedNodes()).toEqual([nodes.G]);
        expect(component.getExpandedNodes()).toEqual([]);
      });
    });
  });

  describe('selectNodeKey', () => {
    it('returns a Promise that resolves after the node is selected', () => {
      waitsForPromise(async () => {
        invariant(renderComponent);
        const component = renderComponent(props);
        await component.setRoots([nodes.A]);

        await component.selectNodeKey(nodes.B.getKey());
        expect(component.getSelectedNodes()).toEqual([nodes.B]);
      });
    });

    it('resolves promises even if they are about to be overridden by a parallel call', () => {
      waitsForPromise(async () => {
        invariant(renderComponent);
        const component = renderComponent(props);

        await component.setRoots([nodes.A]);

        const selectNodeKeyPromise1 = component.selectNodeKey(nodes.B.getKey());
        const selectNodeKeyPromise2 = component.selectNodeKey(nodes.A.getKey());
        await selectNodeKeyPromise2;
        await selectNodeKeyPromise1;
        expect(
          component.getSelectedNodes().map(node => node.getKey()),
        ).toEqual([nodes.A.getKey()]);
      });
    });

    it('rejects if the key does not exist', () => {
      waitsForPromise(async () => {
        invariant(renderComponent);
        const component = renderComponent(props);
        await component.setRoots([nodes.A]);

        let isRejected = false;
        try {
          await component.selectNodeKey('unknown key');
        } catch (error) {
          isRejected = true;
        }
        expect(isRejected).toBe(true);
      });
    });
  });

  describe('expandNodeKey', () => {
    it('returns a Promise that resolves after a container node is expanded', () => {
      waitsForPromise(async () => {
        invariant(renderComponent);
        const component = renderComponent(props);
        await component.setRoots([nodes.G]);

        await component.expandNodeKey(nodes.H.getKey());

        expect(component.getExpandedNodes()).toEqual([nodes.G, nodes.H]);
        const nodeComponents = getNodeComponents(component);
        expect(nodeComponents.J).not.toBeUndefined();
      });
    });

    it('does not expand a non-container node', () => {
      waitsForPromise(async () => {
        invariant(renderComponent);
        const component = renderComponent(props);
        await component.setRoots([nodes.A]);

        await component.expandNodeKey(nodes.B.getKey());

        expect(component.getExpandedNodes()).toEqual([nodes.A]);
      });
    });

    it('rejects older promises even though they will succeed', () => {
      waitsForPromise(async () => {
        invariant(renderComponent);
        const component = renderComponent(props);

        await component.setRoots([nodes.G]);

        const expandNodeKeyPromise1 = component.expandNodeKey(nodes.H.getKey());
        const expandNodeKeyPromise2 = component.expandNodeKey(nodes.I.getKey());
        await expandNodeKeyPromise2;
        let isRejected = false;
        try {
          await expandNodeKeyPromise1;
        } catch (error) {
          isRejected = true;
        }
        expect(isRejected).toBe(true);
        expect(
          component.getExpandedNodes().map(node => node.getKey()),
        ).toEqual([nodes.G.getKey(), nodes.H.getKey(), nodes.I.getKey()]);
      });
    });
  });

  describe('collapseNodeKey', () => {
    it('returns a Promise that resolves after the node is collapsed', () => {
      waitsForPromise(async () => {
        invariant(renderComponent);
        const component = renderComponent(props);
        await component.setRoots([nodes.A]);
        expect(component.getExpandedNodes()).toEqual([nodes.A]);

        await component.collapseNodeKey(nodes.A.getKey());
        expect(component.getExpandedNodes()).toEqual([]);
      });
    });

    it('keeps a non-container node collapsed', () => {
      waitsForPromise(async () => {
        invariant(renderComponent);
        const component = renderComponent(props);
        await component.setRoots([nodes.A]);

        await component.collapseNodeKey(nodes.B.getKey());

        expect(component.getExpandedNodes()).toEqual([nodes.A]);
      });
    });

    it('resolves promises even if they are about to be overridden by a parallel call', () => {
      waitsForPromise(async () => {
        invariant(renderComponent);
        const component = renderComponent(props);

        await component.setRoots([nodes.G]);
        await component.expandNodeKey(nodes.H.getKey());
        await component.expandNodeKey(nodes.I.getKey());

        const collapseNodeKeyPromise1 = component.collapseNodeKey(
          nodes.H.getKey(),
        );
        const collapseNodeKeyPromise2 = component.collapseNodeKey(
          nodes.I.getKey(),
        );
        await collapseNodeKeyPromise2;
        await collapseNodeKeyPromise1;
        expect(
          component.getExpandedNodes().map(node => node.getKey()),
        ).toEqual([nodes.G.getKey()]);
      });
    });

    it('rejects expandNodeKey and resolves collapseNodeKey when called in succession', () => {
      waitsForPromise(async () => {
        invariant(renderComponent);
        const component = renderComponent(props);

        await component.setRoots([nodes.G]);

        const expandNodeKeyPromise = component.expandNodeKey(nodes.H.getKey());
        const collapseNodeKeyPromise = component.collapseNodeKey(
          nodes.H.getKey(),
        );
        await collapseNodeKeyPromise;
        let isRejected = false;
        try {
          await expandNodeKeyPromise;
        } catch (error) {
          isRejected = true;
        }
        expect(isRejected).toBe(true);
        expect(
          component.getExpandedNodes().map(node => node.getKey()),
        ).toEqual([nodes.G.getKey()]);
      });
    });

    it('resolves collapseNodeKey and resolves expandNodeKey when called in succession', () => {
      waitsForPromise(async () => {
        invariant(renderComponent);
        const component = renderComponent(props);

        await component.setRoots([nodes.G]);
        await component.expandNodeKey(nodes.H.getKey());

        const collapseNodeKeyPromise = component.collapseNodeKey(
          nodes.H.getKey(),
        );
        const expandNodeKeyPromise = component.expandNodeKey(nodes.H.getKey());
        await expandNodeKeyPromise;
        await collapseNodeKeyPromise;
        expect(
          component.getExpandedNodes().map(node => node.getKey()),
        ).toEqual([nodes.G.getKey(), nodes.H.getKey()]);
      });
    });
  });

  describe('collapsing a node', () => {
    it('deselects descendants of the node', () => {
      waitsForPromise(async () => {
        invariant(renderComponent);
        const component = renderComponent(props);
        await component.setRoots([nodes.G]);

        component.selectNodeKey(nodes.H.getKey());
        expect(component.getSelectedNodes()).toEqual([nodes.H]);

        component.collapseNodeKey(nodes.G.getKey());
        expect(component.getSelectedNodes()).toEqual([]);
      });
    });

    it('does not deselect the node', () => {
      waitsForPromise(async () => {
        invariant(renderComponent);
        const component = renderComponent(props);
        await component.setRoots([nodes.G]);

        component.selectNodeKey(nodes.G.getKey());
        expect(component.getSelectedNodes()).toEqual([nodes.G]);

        component.collapseNodeKey(nodes.G.getKey());
        expect(component.getSelectedNodes()).toEqual([nodes.G]);
      });
    });
  });

  describe('user interaction', () => {
    let onConfirmSelection: ?{callCount: number};

    beforeEach(() => {
      onConfirmSelection = jasmine.createSpy('onConfirmSelection');
      invariant(props);
      props.onConfirmSelection = onConfirmSelection;
    });

    describe('clicking an arrow', () => {
      it('toggles whether the node is collapsed', () => {
        waitsForPromise(async () => {
          invariant(renderComponent);
          const component = renderComponent(props);
          await component.setRoots([nodes.G]);

          expect(component.getExpandedNodes()).toEqual([nodes.G]);

          const nodeComponents = getNodeComponents(component);
          const arrowNode = ReactDOM.findDOMNode(nodeComponents.G.refs.arrow);
          invariant(arrowNode instanceof Element);
          TestUtils.Simulate.click(arrowNode);

          expect(component.getExpandedNodes()).toEqual([]);
          invariant(onConfirmSelection);
          expect(onConfirmSelection.callCount).toBe(0);
        });
      });

      it('does not toggle whether node is selected', () => {
        waitsForPromise(async () => {
          invariant(renderComponent);
          const component = renderComponent(props);
          await component.setRoots([nodes.G]);

          expect(component.getSelectedNodes()).toEqual([]);

          const nodeComponents = getNodeComponents(component);
          const arrowNode = ReactDOM.findDOMNode(nodeComponents.G.refs.arrow);
          invariant(arrowNode instanceof Element);
          TestUtils.Simulate.click(arrowNode);

          expect(component.getSelectedNodes()).toEqual([]);
          invariant(onConfirmSelection);
          expect(onConfirmSelection.callCount).toBe(0);
        });
      });
    });

    describe('<enter> (i.e. `core:confirm`) on a selected node', () => {
      it('toggles whether the node is collapsed if it is a container', () => {
        waitsForPromise(async () => {
          invariant(renderComponent);
          const component = renderComponent(props);
          await component.setRoots([nodes.G]);
          await component.selectNodeKey(nodes.G.getKey());

          expect(component.getSelectedNodes()).toEqual([nodes.G]);
          expect(component.isNodeKeyExpanded(nodes.G.getKey())).toBe(true);

          invariant(hostEl);
          atom.commands.dispatch(hostEl, 'core:confirm');
          expect(component.isNodeKeyExpanded(nodes.G.getKey())).toBe(false);

          atom.commands.dispatch(hostEl, 'core:confirm');
          expect(component.isNodeKeyExpanded(nodes.G.getKey())).toBe(true);

          invariant(onConfirmSelection);
          expect(onConfirmSelection.callCount).toBe(0);
        });
      });

      it('calls onConfirmSelection if the node is not a container', () => {
        waitsForPromise(async () => {
          invariant(renderComponent);
          const component = renderComponent(props);
          await component.setRoots([nodes.G]);
          await component.expandNodeKey(nodes.H.getKey());
          await component.selectNodeKey(nodes.J.getKey());

          expect(component.getSelectedNodes()).toEqual([nodes.J]);

          invariant(hostEl);
          atom.commands.dispatch(hostEl, 'core:confirm');

          invariant(onConfirmSelection);
          expect(onConfirmSelection).toHaveBeenCalledWith(nodes.J);
          expect(onConfirmSelection.callCount).toBe(1);
        });
      });
    });

    describe('clicking a selected node', () => {
      it('toggles whether the node is collapsed if it is a container', () => {
        waitsForPromise(async () => {
          invariant(renderComponent);
          const component = renderComponent(props);
          await component.setRoots([nodes.G]);
          await component.selectNodeKey(nodes.G.getKey());

          expect(component.getSelectedNodes()).toEqual([nodes.G]);
          expect(component.isNodeKeyExpanded(nodes.G.getKey())).toBe(true);

          const nodeComponents = getNodeComponents(component);
          let gNode = ReactDOM.findDOMNode(nodeComponents.G);
          invariant(gNode instanceof Element);

          TestUtils.Simulate.click(gNode);
          expect(component.isNodeKeyExpanded(nodes.G.getKey())).toBe(false);

          gNode = ReactDOM.findDOMNode(nodeComponents.G);
          invariant(gNode instanceof Element);
          TestUtils.Simulate.click(gNode);
          expect(component.isNodeKeyExpanded(nodes.G.getKey())).toBe(true);

          invariant(onConfirmSelection);
          expect(onConfirmSelection.callCount).toBe(0);
        });
      });

      it('calls onConfirmSelection if the node is not a container', () => {
        waitsForPromise(async () => {
          invariant(renderComponent);
          const component = renderComponent(props);
          await component.setRoots([nodes.G]);
          await component.expandNodeKey(nodes.H.getKey());
          await component.selectNodeKey(nodes.J.getKey());

          expect(component.getSelectedNodes()).toEqual([nodes.J]);

          const nodeComponents = getNodeComponents(component);
          const jNode = ReactDOM.findDOMNode(nodeComponents.J);
          invariant(jNode instanceof Element);
          TestUtils.Simulate.click(jNode);

          invariant(onConfirmSelection);
          expect(onConfirmSelection).toHaveBeenCalledWith(nodes.J);
          expect(onConfirmSelection.callCount).toBe(1);
        });
      });
    });

    describe('clicking an unselected node', () => {
      it('selects the node if it is a container', () => {
        waitsForPromise(async () => {
          invariant(renderComponent);
          const component = renderComponent(props);
          await component.setRoots([nodes.G]);

          expect(component.getSelectedNodes()).toEqual([]);
          expect(component.isNodeKeyExpanded(nodes.G.getKey())).toBe(true);

          const nodeComponents = getNodeComponents(component);
          const gNode = ReactDOM.findDOMNode(nodeComponents.G);
          invariant(gNode instanceof Element);
          TestUtils.Simulate.click(gNode);

          expect(component.getSelectedNodes()).toEqual([nodes.G]);
          expect(component.isNodeKeyExpanded(nodes.G.getKey())).toBe(true);

          invariant(onConfirmSelection);
          expect(onConfirmSelection.callCount).toBe(0);
        });
      });

      it('selects and confirms the node if it is not a container', () => {
        waitsForPromise(async () => {
          invariant(renderComponent);
          const component = renderComponent(props);
          await component.setRoots([nodes.G]);
          await component.expandNodeKey(nodes.H.getKey());

          expect(component.getSelectedNodes()).toEqual([]);

          const nodeComponents = getNodeComponents(component);
          const jNode = ReactDOM.findDOMNode(nodeComponents.J);
          invariant(jNode instanceof Element);
          TestUtils.Simulate.click(jNode);
          expect(component.getSelectedNodes()).toEqual([nodes.J]);

          invariant(onConfirmSelection);
          expect(onConfirmSelection.callCount).toBe(1);
        });
      });

      it('selects node if right clicking or ctrl clicking for context menu', () => {
        waitsForPromise(async () => {
          invariant(renderComponent);
          const component = renderComponent(props);
          await component.setRoots([nodes.G]);

          expect(component.getSelectedNodes()).toEqual([]);

          const nodeComponents = getNodeComponents(component);

          const gNode = ReactDOM.findDOMNode(nodeComponents.G);
          invariant(gNode instanceof Element);
          TestUtils.Simulate.mouseDown(gNode, {button: 2});
          expect(component.getSelectedNodes()).toEqual([
            nodeComponents.G.props.node,
          ]);

          const hNode = ReactDOM.findDOMNode(nodeComponents.H);
          invariant(hNode instanceof Element);
          TestUtils.Simulate.mouseDown(hNode, {
            button: 0,
            ctrlKey: true,
          });
          expect(component.getSelectedNodes()).toEqual([
            nodeComponents.H.props.node,
          ]);

          const iNode = ReactDOM.findDOMNode(nodeComponents.I);
          invariant(iNode instanceof Element);
          TestUtils.Simulate.mouseDown(iNode, {button: 0});
          expect(component.getSelectedNodes()).toEqual([
            nodeComponents.H.props.node,
          ]);

          invariant(onConfirmSelection);
          expect(onConfirmSelection.callCount).toBe(0);
        });
      });
    });
  });

  describe('rendering', () => {
    it('creates one node for each unique path', () => {
      waitsForPromise(async () => {
        invariant(renderComponent);
        const component = renderComponent(props);
        await component.setRoots([nodes.G]);
        // Ensure nodes with children are expanded so their subtrees render.
        await component.expandNodeKey(nodes.H.getKey());
        await component.expandNodeKey(nodes.I.getKey());

        const renderedNodes = TestUtils.scryRenderedComponentsWithType(
          component,
          TreeNodeComponent,
        );
        // 6 nodes should render: G, H, I, J, K, and H(2). The two 'H' nodes have the same label but
        // both should render and be part of the length. If duplicate labels prevent the nodes from
        // rendering, this test will fail.
        expect(renderedNodes.length).toBe(6);
      });
    });
  });
});
