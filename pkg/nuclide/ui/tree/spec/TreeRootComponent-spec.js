'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

var LazyTestTreeNode = require('./LazyTestTreeNode');
var React = require('react-for-atom');
var TreeNodeComponent = require('../lib/TreeNodeComponent');
var TreeRootComponent = require('../lib/TreeRootComponent');

var {TestUtils} = React.addons;

function fetchChildrenForNodes(nodes: Array<LazyFileTreeNode>): Promise {
  return Promise.all(nodes.map((node) => node.fetchChildren()));
}

function clickNodeWithLabel(component: TreeRootComponent, label: string): void {
  var nodeComponents = getNodeComponents(component);
  TestUtils.Simulate.click(nodeComponents[label].getDOMNode());
}

/**
 * Returns an object whose keys are labels and values are TreeNodeComponent's.
 */
function getNodeComponents(component: TreeRootComponent): mixed {
  var nodeComponents = {};
  TestUtils.scryRenderedComponentsWithType(component, TreeNodeComponent)
      .forEach(nodeComponent => {
        var label = nodeComponent.props.node.getItem().label;
        nodeComponents[label] = nodeComponent;
      });
  return nodeComponents;
}

describe('TreeRootComponent', () => {

  // Use `renderComponent` in `beforeEach` to return the component so the test
  // methods have a chance to modify the default props.
  var renderComponent: (props: mixed) => ReactComponent;
  var props;
  var hostEl;
  var nodes;

  beforeEach(() => {
    nodes = {};

    //   A
    //  / \
    // B   C
    nodes['A'] = new LazyTestTreeNode({label: 'A'}, /* parent */ null, true, async () => [nodes['B'], nodes['C']]);
    nodes['B'] = new LazyTestTreeNode({label: 'B'}, /* parent */ nodes['A'], false, async () => null);
    nodes['C'] = new LazyTestTreeNode({label: 'C'}, /* parent */ nodes['A'], false, async () => null);

    //   D
    //  / \
    // E   F
    nodes['D'] = new LazyTestTreeNode({label: 'D'}, /* parent */ null, true, async () => [nodes['E'], nodes['F']]);
    nodes['E'] = new LazyTestTreeNode({label: 'E'}, /* parent */ nodes['D'], false, async () => null);
    nodes['F'] = new LazyTestTreeNode({label: 'F'}, /* parent */ nodes['D'], false, async () => null);

    //      G
    //     / \
    //    H   I
    //  /
    // J
    nodes['G'] = new LazyTestTreeNode({label: 'G'}, /* parent */ null, true, async () => [nodes['H'], nodes['I']]);
    nodes['H'] = new LazyTestTreeNode({label: 'H'}, /* parent */ nodes['G'], true, async () => [nodes['J']]);
    nodes['J'] = new LazyTestTreeNode({label: 'J'}, /* parent */ nodes['H'], false, async () => null);
    nodes['I'] = new LazyTestTreeNode({label: 'I'}, /* parent */ nodes['G'], false, async () => null);

    hostEl = document.createElement('div');
    hostEl.className = 'test';
    renderComponent = (componentProps) => {
      return React.render(
          <TreeRootComponent {...componentProps} />,
          hostEl);
    };

    props = {
      initialRoots: [nodes['A'], nodes['D']],
      eventHandlerSelector: '.test',
      labelClassNameForNode: (node) => node.getItem().label,
    };
  });

  describe('setRoots', () => {
    it('preserves state for reusable roots + removes state for non-reusable roots', () => {
      var component = renderComponent(props);
      component.setRoots([nodes['G'], nodes['A']]);

      expect(component.getRootNodes()).toEqual([nodes['G'], nodes['A']]);
      expect(component.getSelectedNodes()).toEqual([nodes['A']]);
      expect(component.getExpandedNodes()).toEqual([nodes['A'], nodes['G']]);
    });
  });

  describe('handling core:move-left', () => {
    it('moves the selection to the parent when collapsing a non-container node', () => {
      waitsForPromise(async () => {
        var component = renderComponent(props);
        component.setRoots([nodes['A']]);
        await fetchChildrenForNodes(component.getRootNodes());

        clickNodeWithLabel(component, 'B');
        expect(component.getSelectedNodes()).toEqual([nodes['B']]);

        atom.commands.dispatch(hostEl, 'core:move-left');
        expect(component.getSelectedNodes()).toEqual([nodes['A']]);
        expect(component.getExpandedNodes()).toEqual([nodes['A']]);
      });
    });

    it('moves the selection to the parent when collapsing an already-collapsed container node', () => {
      waitsForPromise(async () => {
        var component = renderComponent(props);
        component.setRoots([nodes['G']]);
        await fetchChildrenForNodes(component.getRootNodes());

        clickNodeWithLabel(component, 'H');
        expect(component.getSelectedNodes()).toEqual([nodes['H']]);
        expect(component.getExpandedNodes()).toEqual([nodes['G']]);

        atom.commands.dispatch(hostEl, 'core:move-left');
        expect(component.getSelectedNodes()).toEqual([nodes['G']]);
        expect(component.getExpandedNodes()).toEqual([nodes['G']]);
      });
    });

    it('collapses the selection when collapsing an expanded container node', () => {
      waitsForPromise(async () => {
        var component = renderComponent(props);
        component.setRoots([nodes['G']]);
        await fetchChildrenForNodes(component.getRootNodes());

        clickNodeWithLabel(component, 'H');
        atom.commands.dispatch(hostEl, 'core:move-right');
        expect(component.getSelectedNodes()).toEqual([nodes['H']]);
        expect(component.getExpandedNodes()).toEqual([nodes['G'], nodes['H']]);

        atom.commands.dispatch(hostEl, 'core:move-left');
        expect(component.getSelectedNodes()).toEqual([nodes['H']]);
        expect(component.getExpandedNodes()).toEqual([nodes['G']]);
      });
    });

    it('does nothing when collapsing an already-collapsed root element', () => {
      waitsForPromise(async () => {
        var component = renderComponent(props);
        component.setRoots([nodes['G']]);
        await fetchChildrenForNodes(component.getRootNodes());

        clickNodeWithLabel(component, 'G');
        expect(component.getSelectedNodes()).toEqual([nodes['G']]);
        atom.commands.dispatch(hostEl, 'core:move-left');
        expect(component.getExpandedNodes()).toEqual([]);

        atom.commands.dispatch(hostEl, 'core:move-left');
        expect(component.getSelectedNodes()).toEqual([nodes['G']]);
        expect(component.getExpandedNodes()).toEqual([]);
      });
    });

    it('collapses the selection when collapsing an expanded root element', () => {
      waitsForPromise(async () => {
        var component = renderComponent(props);
        component.setRoots([nodes['G']]);
        await fetchChildrenForNodes(component.getRootNodes());

        clickNodeWithLabel(component, 'G');
        expect(component.getSelectedNodes()).toEqual([nodes['G']]);
        expect(component.getExpandedNodes()).toEqual([nodes['G']]);

        atom.commands.dispatch(hostEl, 'core:move-left');
        expect(component.getSelectedNodes()).toEqual([nodes['G']]);
        expect(component.getExpandedNodes()).toEqual([]);
      });
    });
  });

  describe('collapsing a node', () => {

    it('deselects descendants of the node', () => {
      waitsForPromise(async () => {
        var component = renderComponent(props);
        component.setRoots([nodes['G']]);
        await fetchChildrenForNodes(component.getRootNodes());

        component.selectNodeKey(nodes['H'].getKey());
        expect(component.getSelectedNodes()).toEqual([nodes['H']]);

        component.collapseNodeKey(nodes['G'].getKey());
        expect(component.getSelectedNodes()).toEqual([]);
      });
    });

    it('does not deselect the node', () => {
      waitsForPromise(async () => {
        var component = renderComponent(props);
        component.setRoots([nodes['G']]);
        await fetchChildrenForNodes(component.getRootNodes());

        component.selectNodeKey(nodes['G'].getKey());
        expect(component.getSelectedNodes()).toEqual([nodes['G']]);

        component.collapseNodeKey(nodes['G'].getKey());
        expect(component.getSelectedNodes()).toEqual([nodes['G']]);
      });
    });

  });

  describe('clicking a node', () => {

    it('toggles whether the node is selected', () => {
      waitsForPromise(async () => {
        var component = renderComponent(props);
        component.setRoots([nodes['G']]);
        await fetchChildrenForNodes(component.getRootNodes());

        expect(component.getSelectedNodes()).toEqual([]);

        var treeNodes = TestUtils.scryRenderedComponentsWithType(
            component,
            TreeNodeComponent
          );
        var firstTreeNodeDomNode = React.findDOMNode(treeNodes[0]);

        TestUtils.Simulate.click(firstTreeNodeDomNode);

        expect(component.getSelectedNodes()).toEqual([nodes['G']]);
      });
    });

    it('toggles whether the node is collapsed if click is on the arrow', () => {
      waitsForPromise(async () => {
        var component = renderComponent(props);
        component.setRoots([nodes['G']]);
        await fetchChildrenForNodes(component.getRootNodes());

        expect(component.getExpandedNodes()).toEqual([nodes['G']]);

        var treeNodes = TestUtils.scryRenderedComponentsWithType(
            component,
            TreeNodeComponent
          );
        var firstTreeNodeArrowDomNode =
            React.findDOMNode(treeNodes[0].refs['arrow']);

        TestUtils.Simulate.click(firstTreeNodeArrowDomNode);

        expect(component.getExpandedNodes()).toEqual([]);
      });
    });

    it('selects node if right clicking or ctrl clicking for context menu', () => {
      waitsForPromise(async () => {
        var component = renderComponent(props);
        component.setRoots([nodes['G']]);
        await fetchChildrenForNodes(component.getRootNodes());

        expect(component.getSelectedNodes()).toEqual([]);

        var treeNodes = TestUtils.scryRenderedComponentsWithType(
            component,
            TreeNodeComponent
          );

        TestUtils.Simulate.mouseDown(treeNodes[0].getDOMNode(), {button: 2});
        expect(component.getSelectedNodes()).toEqual([treeNodes[0].props.node]);

        TestUtils.Simulate.mouseDown(treeNodes[1].getDOMNode(), {button: 0, ctrlKey: true});
        expect(component.getSelectedNodes()).toEqual([treeNodes[1].props.node]);

        TestUtils.Simulate.mouseDown(treeNodes[2].getDOMNode(), {button: 0});
        expect(component.getSelectedNodes()).toEqual([treeNodes[1].props.node]);
      });
    });

    it('does not toggle whether node is selected if click is on the arrow', () => {
      waitsForPromise(async () => {
        var component = renderComponent(props);
        component.setRoots([nodes['G']]);
        await fetchChildrenForNodes(component.getRootNodes());

        expect(component.getSelectedNodes()).toEqual([]);

        var treeNodes = TestUtils.scryRenderedComponentsWithType(
            component,
            TreeNodeComponent
          );
        var firstTreeNodeArrowDomNode =
            React.findDOMNode(treeNodes[0].refs['arrow']);

        TestUtils.Simulate.click(firstTreeNodeArrowDomNode);

        expect(component.getSelectedNodes()).toEqual([]);
      });
    });

  });

});
