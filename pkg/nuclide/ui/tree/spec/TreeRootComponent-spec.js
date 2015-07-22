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

function clickNodeWithLabel(component: TreeRootComponent, label: string): void {
  var nodeComponents = getNodeComponents(component);
  TestUtils.Simulate.click(React.findDOMNode(nodeComponents[label]));
}

/**
 * Returns an object whose keys are labels and values are TreeNodeComponent's.
 */
function getNodeComponents(component: TreeRootComponent): any {
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
  var renderComponent: (props: any) => TreeRootComponent;
  var props;
  var hostEl;
  var nodes: {[key: string]: LazyTreeNode};

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
    //  /   /
    // J   K
    nodes['G'] = new LazyTestTreeNode({label: 'G'}, /* parent */ null, true, async () => [nodes['H'], nodes['I']]);
    nodes['H'] = new LazyTestTreeNode({label: 'H'}, /* parent */ nodes['G'], true, async () => [nodes['J']]);
    nodes['I'] = new LazyTestTreeNode({label: 'I'}, /* parent */ nodes['G'], true, async () => [nodes['K']]);
    nodes['J'] = new LazyTestTreeNode({label: 'J'}, /* parent */ nodes['H'], false, async () => null);
    nodes['K'] = new LazyTestTreeNode({label: 'K'}, /* parent */ nodes['I'], false, async () => null);

    hostEl = document.createElement('div');
    hostEl.className = 'test';
    renderComponent = (componentProps) => {
      return React.render(
          <TreeRootComponent {...componentProps} />,
          hostEl);
    };

    props = {
      initialRoots: [],
      eventHandlerSelector: '.test',
      labelClassNameForNode: (node) => node.getItem().label,
      onKeepSelection() {},
      rowClassNameForNode: (node) => '',
    };
  });

  describe('setRoots', () => {
    it('preserves state for reusable roots + removes state for non-reusable roots', () => {
      waitsForPromise(async () => {
        var component = renderComponent(props);
        await component.setRoots([nodes['A']]);
        await component.setRoots([nodes['G'], nodes['A']]);

        expect(component.getRootNodes()).toEqual([nodes['G'], nodes['A']]);
        expect(component.getSelectedNodes()).toEqual([]);
        var expandedNodeKeys = component.getExpandedNodes().map(node => node.getKey());
        expect(expandedNodeKeys).toEqual([nodes['G'].getKey(), nodes['A'].getKey()]);
      });
    });

    it('returns a Promise that resolves after the children are rendered', () => {
      waitsForPromise(async () => {
        var component = renderComponent(props);

        // The children should be in the tree if we `await` the promise.
        await component.setRoots([nodes['D']]);
        var nodeComponents = getNodeComponents(component);
        expect(nodeComponents['E']).not.toBeUndefined();

        // The children shouldn't immediately be in the tree if we don't
        // `await` the promise.
        component.setRoots([nodes['A']]);
        nodeComponents = getNodeComponents(component);
        expect(nodeComponents['B']).toBeUndefined();
      });
    });

    it('rejects outdated promises', () => {
      waitsForPromise(async () => {
        var component = renderComponent(props);

        var setRootsPromise1 = component.setRoots([nodes['A']]);
        var setRootsPromise2 = component.setRoots([nodes['D']]);
        await setRootsPromise2;
        var isRejected = false;
        try {
          await setRootsPromise1;
        } catch (error) {
          isRejected = true;
        }
        expect(isRejected).toBe(true);
        var nodeComponents = getNodeComponents(component);
        expect(nodeComponents['B']).toBeUndefined();
        expect(nodeComponents['E']).not.toBeUndefined();
      });
    });
  });

  describe('invalidateCachedNodes', () => {
    it('invalidates the cached nodes', () => {
      waitsForPromise(async () => {
        var component = renderComponent(props);
        await component.setRoots([nodes['G'], nodes['A']]);

        expect(nodes['G'].isCacheValid()).toBe(true);
        expect(nodes['A'].isCacheValid()).toBe(true);

        component.invalidateCachedNodes();

        expect(nodes['G'].isCacheValid()).toBe(false);
        expect(nodes['A'].isCacheValid()).toBe(false);
      });
    });
  });

  describe('handling core:move-left', () => {
    it('moves the selection to the parent when collapsing a non-container node', () => {
      waitsForPromise(async () => {
        var component = renderComponent(props);
        await component.setRoots([nodes['A']]);

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
        await component.setRoots([nodes['G']]);

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
        await component.setRoots([nodes['G']]);

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
        await component.setRoots([nodes['G']]);

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
        await component.setRoots([nodes['G']]);

        clickNodeWithLabel(component, 'G');
        expect(component.getSelectedNodes()).toEqual([nodes['G']]);
        expect(component.getExpandedNodes()).toEqual([nodes['G']]);

        atom.commands.dispatch(hostEl, 'core:move-left');
        expect(component.getSelectedNodes()).toEqual([nodes['G']]);
        expect(component.getExpandedNodes()).toEqual([]);
      });
    });
  });

  describe('selectNodeKey', () => {
    it('returns a Promise that resolves after the node is selected', () => {
      waitsForPromise(async () => {
        var component = renderComponent(props);
        await component.setRoots([nodes['A']]);

        await component.selectNodeKey(nodes['B'].getKey());
        expect(component.getSelectedNodes()).toEqual([nodes['B']]);
      });
    });

    it('resolves promises even if they are about to be overridden by a parallel call', () => {
      waitsForPromise(async () => {
        var component = renderComponent(props);

        await component.setRoots([nodes['A']]);

        var selectNodeKeyPromise1 = component.selectNodeKey(nodes['B'].getKey());
        var selectNodeKeyPromise2 = component.selectNodeKey(nodes['A'].getKey());
        await selectNodeKeyPromise2;
        await selectNodeKeyPromise1;
        expect(component.getSelectedNodes().map(node => node.getKey()))
            .toEqual([nodes['A'].getKey()]);
      });
    });

    it('rejects if the key does not exist', () => {
      waitsForPromise(async () => {
        var component = renderComponent(props);
        await component.setRoots([nodes['A']]);

        var isRejected = false;
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
        var component = renderComponent(props);
        await component.setRoots([nodes['G']]);

        await component.expandNodeKey(nodes['H'].getKey());

        expect(component.getExpandedNodes()).toEqual([nodes['G'], nodes['H']]);
        var nodeComponents = getNodeComponents(component);
        expect(nodeComponents['J']).not.toBeUndefined();
      });
    });

    it('does not expand a non-container node', () => {
      waitsForPromise(async () => {
        var component = renderComponent(props);
        await component.setRoots([nodes['A']]);

        await component.expandNodeKey(nodes['B'].getKey());

        expect(component.getExpandedNodes()).toEqual([nodes['A']]);
      });
    });

    it('rejects older promises even though they will succeed', () => {
      waitsForPromise(async () => {
        var component = renderComponent(props);

        await component.setRoots([nodes['G']]);

        var expandNodeKeyPromise1 = component.expandNodeKey(nodes['H'].getKey());
        var expandNodeKeyPromise2 = component.expandNodeKey(nodes['I'].getKey());
        await expandNodeKeyPromise2;
        var isRejected = false;
        try {
          await expandNodeKeyPromise1;
        } catch (error) {
          isRejected = true;
        }
        expect(isRejected).toBe(true);
        expect(component.getExpandedNodes().map(node => node.getKey()))
            .toEqual([
              nodes['G'].getKey(),
              nodes['H'].getKey(),
              nodes['I'].getKey(),
            ]);
      });
    });
  });

  describe('collapseNodeKey', () => {
    it('returns a Promise that resolves after the node is collapsed', () => {
      waitsForPromise(async () => {
        var component = renderComponent(props);
        await component.setRoots([nodes['A']]);
        expect(component.getExpandedNodes()).toEqual([nodes['A']]);

        await component.collapseNodeKey(nodes['A'].getKey());
        expect(component.getExpandedNodes()).toEqual([]);
      });
    });

    it('keeps a non-container node collapsed', () => {
      waitsForPromise(async () => {
        var component = renderComponent(props);
        await component.setRoots([nodes['A']]);

        await component.collapseNodeKey(nodes['B'].getKey());

        expect(component.getExpandedNodes()).toEqual([nodes['A']]);
      });
    });

    it('resolves promises even if they are about to be overridden by a parallel call', () => {
      waitsForPromise(async () => {
        var component = renderComponent(props);

        await component.setRoots([nodes['G']]);
        await component.expandNodeKey(nodes['H'].getKey());
        await component.expandNodeKey(nodes['I'].getKey());

        var collapseNodeKeyPromise1 = component.collapseNodeKey(nodes['H'].getKey());
        var collapseNodeKeyPromise2 = component.collapseNodeKey(nodes['I'].getKey());
        await collapseNodeKeyPromise2;
        await collapseNodeKeyPromise1;
        expect(component.getExpandedNodes().map(node => node.getKey()))
            .toEqual([
              nodes['G'].getKey(),
            ]);
      });
    });

    it('rejects expandNodeKey and resolves collapseNodeKey when called in succession', () => {
      waitsForPromise(async () => {
        var component = renderComponent(props);

        await component.setRoots([nodes['G']]);

        var expandNodeKeyPromise = component.expandNodeKey(nodes['H'].getKey());
        var collapseNodeKeyPromise = component.collapseNodeKey(nodes['H'].getKey());
        await collapseNodeKeyPromise;
        var isRejected = false;
        try {
          await expandNodeKeyPromise;
        } catch (error) {
          isRejected = true;
        }
        expect(isRejected).toBe(true);
        expect(component.getExpandedNodes().map(node => node.getKey()))
            .toEqual([
              nodes['G'].getKey(),
            ]);
      });
    });

    it('resolves collapseNodeKey and resolves expandNodeKey when called in succession', () => {
      waitsForPromise(async () => {
        var component = renderComponent(props);

        await component.setRoots([nodes['G']]);
        await component.expandNodeKey(nodes['H'].getKey());

        var collapseNodeKeyPromise = component.collapseNodeKey(nodes['H'].getKey());
        var expandNodeKeyPromise = component.expandNodeKey(nodes['H'].getKey());
        await expandNodeKeyPromise;
        await collapseNodeKeyPromise;
        expect(component.getExpandedNodes().map(node => node.getKey()))
            .toEqual([
              nodes['G'].getKey(),
              nodes['H'].getKey(),
            ]);
      });
    });
  });

  describe('collapsing a node', () => {
    it('deselects descendants of the node', () => {
      waitsForPromise(async () => {
        var component = renderComponent(props);
        await component.setRoots([nodes['G']]);

        component.selectNodeKey(nodes['H'].getKey());
        expect(component.getSelectedNodes()).toEqual([nodes['H']]);

        component.collapseNodeKey(nodes['G'].getKey());
        expect(component.getSelectedNodes()).toEqual([]);
      });
    });

    it('does not deselect the node', () => {
      waitsForPromise(async () => {
        var component = renderComponent(props);
        await component.setRoots([nodes['G']]);

        component.selectNodeKey(nodes['G'].getKey());
        expect(component.getSelectedNodes()).toEqual([nodes['G']]);

        component.collapseNodeKey(nodes['G'].getKey());
        expect(component.getSelectedNodes()).toEqual([nodes['G']]);
      });
    });
  });

  describe('user interaction', () => {
    var onConfirmSelection;

    beforeEach(() => {
      onConfirmSelection = jasmine.createSpy('onConfirmSelection');
      props.onConfirmSelection = onConfirmSelection;
    });

    describe('clicking an arrow', () => {
      it('toggles whether the node is collapsed', () => {
        waitsForPromise(async () => {
          var component = renderComponent(props);
          await component.setRoots([nodes['G']]);

          expect(component.getExpandedNodes()).toEqual([nodes['G']]);

          var nodeComponents = getNodeComponents(component);
          TestUtils.Simulate.click(React.findDOMNode(nodeComponents['G'].refs['arrow']));

          expect(component.getExpandedNodes()).toEqual([]);
          expect(onConfirmSelection.callCount).toBe(0);
        });
      });

      /*
       * Little bit flaky since the nodes here doesn't
       * actually represent nodes rendered in Atom.
       * LazyTestTreeNode is used here while LazyFileTreeNode is used in Atom.
       */
      it('toggles child nodes if alt-clicked', () => {
        waitsForPromise(async () => {
          var component = renderComponent(props);
          spyOn(component, '_toggleChildNodesExpanded').andCallFake(() => {
            return {
              then: (callback) => callback()
            };
          });
          await component.setRoots([nodes['G']]);
          expect(component.getExpandedNodes()).toEqual([nodes['G']]);

          var nodeComponents = getNodeComponents(component);

          // Collapse node
          TestUtils.Simulate.click(React.findDOMNode(nodeComponents['G'].refs['arrow']));
          expect(component.getExpandedNodes()).toEqual([]);

          // Alt-click node
          TestUtils.Simulate.click(React.findDOMNode(nodeComponents['G'].refs['arrow']), {altKey: true});

          // expect _toggleChildNodesExpanded to only be called once
          expect(component._toggleChildNodesExpanded.calls.length).toBe(1);
        });
      });

      xit('ignores ignored files when alt-clicking', () => {

      });

      it('does not toggle whether node is selected', () => {
        waitsForPromise(async () => {
          var component = renderComponent(props);
          await component.setRoots([nodes['G']]);

          expect(component.getSelectedNodes()).toEqual([]);

          var nodeComponents = getNodeComponents(component);
          TestUtils.Simulate.click(React.findDOMNode(nodeComponents['G'].refs['arrow']));

          expect(component.getSelectedNodes()).toEqual([]);
          expect(onConfirmSelection.callCount).toBe(0);
        });
      });
    });

    describe('<enter> (i.e. `core:confirm`) on a selected node', () => {
      it('toggles whether the node is collapsed if it is a container', () => {
        waitsForPromise(async () => {
          var component = renderComponent(props);
          await component.setRoots([nodes['G']]);
          await component.selectNodeKey(nodes['G'].getKey())

          expect(component.getSelectedNodes()).toEqual([nodes['G']]);
          expect(component.isNodeKeyExpanded(nodes['G'].getKey())).toBe(true);

          atom.commands.dispatch(hostEl, 'core:confirm');
          expect(component.isNodeKeyExpanded(nodes['G'].getKey())).toBe(false);

          atom.commands.dispatch(hostEl, 'core:confirm');
          expect(component.isNodeKeyExpanded(nodes['G'].getKey())).toBe(true);

          expect(onConfirmSelection.callCount).toBe(0);
        });
      });

      it('calls onConfirmSelection if the node is not a container', () => {
        waitsForPromise(async () => {
          var component = renderComponent(props);
          await component.setRoots([nodes['G']]);
          await component.expandNodeKey(nodes['H'].getKey());
          await component.selectNodeKey(nodes['J'].getKey())

          expect(component.getSelectedNodes()).toEqual([nodes['J']]);

          atom.commands.dispatch(hostEl, 'core:confirm');

          expect(onConfirmSelection).toHaveBeenCalledWith(nodes['J']);
          expect(onConfirmSelection.callCount).toBe(1);
        });
      });
    });

    describe('clicking a selected node', () => {
      it('toggles whether the node is collapsed if it is a container', () => {
        waitsForPromise(async () => {
          var component = renderComponent(props);
          await component.setRoots([nodes['G']]);
          await component.selectNodeKey(nodes['G'].getKey())

          expect(component.getSelectedNodes()).toEqual([nodes['G']]);
          expect(component.isNodeKeyExpanded(nodes['G'].getKey())).toBe(true);

          var nodeComponents = getNodeComponents(component);

          TestUtils.Simulate.click(React.findDOMNode(nodeComponents['G']));
          expect(component.isNodeKeyExpanded(nodes['G'].getKey())).toBe(false);

          TestUtils.Simulate.click(React.findDOMNode(nodeComponents['G']));
          expect(component.isNodeKeyExpanded(nodes['G'].getKey())).toBe(true);

          expect(onConfirmSelection.callCount).toBe(0);
        });
      });

      it('calls onConfirmSelection if the node is not a container', () => {
        waitsForPromise(async () => {
          var component = renderComponent(props);
          await component.setRoots([nodes['G']]);
          await component.expandNodeKey(nodes['H'].getKey());
          await component.selectNodeKey(nodes['J'].getKey())

          expect(component.getSelectedNodes()).toEqual([nodes['J']]);

          var nodeComponents = getNodeComponents(component);
          TestUtils.Simulate.click(React.findDOMNode(nodeComponents['J']));

          expect(onConfirmSelection).toHaveBeenCalledWith(nodes['J']);
          expect(onConfirmSelection.callCount).toBe(1);
        });
      });
    });

    describe('clicking an unselected node', () => {
      it('selects the node if it is a container', () => {
        waitsForPromise(async () => {
          var component = renderComponent(props);
          await component.setRoots([nodes['G']]);

          expect(component.getSelectedNodes()).toEqual([]);
          expect(component.isNodeKeyExpanded(nodes['G'].getKey())).toBe(true);

          var nodeComponents = getNodeComponents(component);
          TestUtils.Simulate.click(React.findDOMNode(nodeComponents['G']));

          expect(component.getSelectedNodes()).toEqual([nodes['G']]);
          expect(component.isNodeKeyExpanded(nodes['G'].getKey())).toBe(true);

          expect(onConfirmSelection.callCount).toBe(0);
        });
      });

      it('selects the node if it is not a container', () => {
        waitsForPromise(async () => {
          var component = renderComponent(props);
          await component.setRoots([nodes['G']]);
          await component.expandNodeKey(nodes['H'].getKey());

          expect(component.getSelectedNodes()).toEqual([]);

          var nodeComponents = getNodeComponents(component);
          TestUtils.Simulate.click(React.findDOMNode(nodeComponents['J']));
          expect(component.getSelectedNodes()).toEqual([nodes['J']]);

          expect(onConfirmSelection.callCount).toBe(0);
        });
      });

      it('selects node if right clicking or ctrl clicking for context menu', () => {
        waitsForPromise(async () => {
          var component = renderComponent(props);
          await component.setRoots([nodes['G']]);

          expect(component.getSelectedNodes()).toEqual([]);

          var nodeComponents = getNodeComponents(component);

          TestUtils.Simulate.mouseDown(React.findDOMNode(nodeComponents['G']), {button: 2});
          expect(component.getSelectedNodes()).toEqual([nodeComponents['G'].props.node]);

          TestUtils.Simulate.mouseDown(React.findDOMNode(nodeComponents['H']), {button: 0, ctrlKey: true});
          expect(component.getSelectedNodes()).toEqual([nodeComponents['H'].props.node]);

          TestUtils.Simulate.mouseDown(React.findDOMNode(nodeComponents['I']), {button: 0});
          expect(component.getSelectedNodes()).toEqual([nodeComponents['H'].props.node]);

          expect(onConfirmSelection.callCount).toBe(0);
        });
      });
    });
  });
});
