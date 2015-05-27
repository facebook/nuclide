'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

var {CompositeDisposable} = require('atom');
var LazyTreeNode = require('./LazyTreeNode');
var TreeNodeComponent = require('./TreeNodeComponent');
var {forEachCachedNode} = require('./tree-node-traversals');
var React = require('react-for-atom');

var {PropTypes} = React;

type TreeMenuItemDefinition = {
  label: string;
  command: string;
  submenu: ?Array<TreeMenuItemDefinition>;
  shouldDisplay: ?() => boolean;
  shouldDisplayForSelectedNodes: ?(nodes: Array<LazyTreeNode>) => boolean;

  // By default, no context menu item will be displayed if the tree is empty.
  // Set this to true to override that behavior.
  shouldDisplayIfTreeIsEmpty: ?boolean;
};

type TreeComponentState = {
  expandedNodeKeys: Array<string>;
  selectedNodeKeys: Array<string>;
};

/**
 * Toggles the existence of a value in a set. If the value exists, deletes it.
 * If the value does not exist, adds it.
 *
 * @param set The set whose value to toggle.
 * @param value The value to toggle in the set.
 * @param [forceHas] If defined, forces the existence of the value in the set
 *     regardless of its current existence. If truthy, adds `value`, if falsy
 *     deletes `value`.
 * @returns `true` if the value was added to the set, otherwise `false`. If
 *     `forceHas` is defined, the return value will be equal to `forceHas`.
 */
function toggleSetHas(
    set: Set<string>,
    value: string,
    forceHas?: ?boolean
): boolean {
  var added;

  if (forceHas || (forceHas === undefined && !set.has(value))) {
    set.add(value);
    added = true;
  } else {
    set.delete(value);
    added = false;
  }

  return added;
}

var FIRST_SELECTED_DESCENDANT_REF: string = 'firstSelectedDescendant';

/**
 * Generic tree component that operates on LazyTreeNodes.
 */
var TreeRootComponent = React.createClass({
  propTypes: {
    initialRoots: PropTypes.arrayOf(PropTypes.instanceOf(LazyTreeNode)).isRequired,
    eventHandlerSelector: PropTypes.string.isRequired,
    onClickNode: PropTypes.func.isRequired,
    onClickNodeArrow: PropTypes.func.isRequired,
    onConfirmSelection: PropTypes.func.isRequired,
    labelClassNameForNode: PropTypes.func.isRequired,
    rowClassNameForNode: PropTypes.func,
    // Render will return this component if there are no root nodes.
    elementToRenderWhenEmpty: PropTypes.element,
    initialExpandedNodeKeys: PropTypes.arrayOf(PropTypes.string),
    initialSelectedNodeKeys: PropTypes.arrayOf(PropTypes.string),
  },

  getDefaultProps(): mixed {
    return {
      onClickNode(node: LazyTreeNode) {},
      onClickNodeArrow(node: LazyTreeNode) {},
      onConfirmSelection(node: LazyTreeNode) {},
      elementToRenderWhenEmpty: null,
    };
  },

  getInitialState(): mixed {
    var rootKeys = this.props.initialRoots.map((root) => root.getKey());

    var selectedKeys;
    if (this.props.initialSelectedNodeKeys) {
      selectedKeys = new Set(this.props.initialSelectedNodeKeys);
    } else {
      selectedKeys = new Set(rootKeys.length === 0 ? [] : [rootKeys[0]]);
    }

    return {
      roots: this.props.initialRoots,
      // This is maintained as a set of strings for two reasons:
      // (1) It is straightforward to serialize.
      // (2) If the LazyFileTreeNode for a path is re-created, this will still work.
      expandedKeys: new Set(this.props.initialExpandedNodeKeys || rootKeys),
      selectedKeys,
    };
  },

  componentDidUpdate(prevProps: mixed, prevState: mixed): void {
    // If the Set of selected items is new, like when navigating the tree with
    // the arrow keys, scroll the first item into view. This addresses the
    // following scenario:
    // (1) Select a node in the tree
    // (2) Scroll the selected node out of the viewport
    // (3) Press the up or down arrow key to change the selected node
    // (4) The new node should scroll into view
    if (this.state.selectedKeys !== prevState.selectedKeys) {
      var firstSelectedDescendant = this.refs[FIRST_SELECTED_DESCENDANT_REF];
      if (firstSelectedDescendant !== undefined) {
        firstSelectedDescendant.getDOMNode().scrollIntoViewIfNeeded(false);
      }
    }
  },

  _deselectDescendants(root: LazyTreeNode): void {
    var selectedKeys = this.state.selectedKeys;

    forEachCachedNode(root, node => {
      // `forEachCachedNode` iterates over the root, but it should remain
      // selected. Skip it.
      if (node === root) {
        return;
      }

      selectedKeys.delete(node.getKey());
    });

    this.setState({selectedKeys});
  },

  _isNodeExpanded(node: LazyTreeNode): boolean {
    return this.state.expandedKeys.has(node.getKey());
  },

  _isNodeSelected(node: LazyTreeNode): boolean {
    return this.state.selectedKeys.has(node.getKey());
  },

  _toggleNodeExpanded(node: LazyTreeNode, forceExpanded?: ?boolean): void {
    var expandedKeys = this.state.expandedKeys;
    var keyAdded = toggleSetHas(expandedKeys, node.getKey(), forceExpanded);

    // If the node was collapsed, deselect its descendants so only nodes visible
    // in the tree remain selected.
    if (!keyAdded) {
      this._deselectDescendants(node);
    }

    this.setState({expandedKeys});
  },

  _toggleNodeSelected(node: LazyTreeNode, forceSelected?: ?boolean): void {
    var selectedKeys = this.state.selectedKeys;
    toggleSetHas(selectedKeys, node.getKey(), forceSelected);
    this.setState({selectedKeys});
  },

  _onClickNode(event: SyntheticMouseEvent, node: LazyTreeNode): void {
    if (event.metaKey) {
      this._toggleNodeSelected(node);
      return;
    }

    this.setState({
      selectedKeys: new Set([node.getKey()]),
    });

    if (!this._isNodeSelected(node)) {
      // User clicked on a new item, so do not toggle its state any further yet.
      return;
    }

    if (node.isContainer()) {
      this._toggleNodeExpanded(node);
    } else {
      this.props.onClickNode(node);
    }
  },

  _onClickNodeArrow(event: SyntheticEvent, node: LazyTreeNode): void {
    this._toggleNodeExpanded(node);
  },

  _onMouseDown(event: SyntheticMouseEvent, node: LazyTreeNode): void {
    // Select the node on right-click.
    if (event.button === 2 || (event.button === 0 && event.ctrlKey === true)) {
      if (!this._isNodeSelected(node)) {
        this.setState({selectedKeys: new Set([node.getKey()])});
      }
    }
  },

  addContextMenuItemGroup(menuItemDefinitions: Array<TreeMenuItemDefinition>): void {
    var items = menuItemDefinitions.slice();
    items = items.map((definition) => {
      definition.shouldDisplay = () => {
        if (this.state.roots.length === 0 && !definition.shouldDisplayIfTreeIsEmpty) {
          return false;
        }
        if (definition.shouldDisplayForSelectedNodes) {
          return definition.shouldDisplayForSelectedNodes(this.getSelectedNodes());
        }
        return true;
      };
      return definition;
    });
    // Atom is smart about only displaying a separator when there are items to
    // separate, so there will never be a dangling separator at the end.
    items.push({type: 'separator'});

    atom.contextMenu.add({
      [this.props.eventHandlerSelector]: items,
    });
  },

  render(): ?ReactElement {
    if (this.state.roots.length === 0) {
      return this.props.elementToRenderWhenEmpty;
    }

    var children = [];
    var expandedKeys = this.state.expandedKeys;
    var foundFirstSelectedDescendant: boolean = false;

    var promises: Array<Promise> = [];
    var allKeys: Array<string> = [];
    var keyToNode: { [key:string]: LazyTreeNode} = {};

    this.state.roots.forEach((root) => {
      var stack = [{node: root, depth: 0}];

      while (stack.length !== 0) {
        // Pop off the top of the stack and add it to the list of nodes to display.
        var item = stack.pop();
        var node = item.node;

        // Keep a reference the first selected descendant with
        // `this.refs[FIRST_SELECTED_DESCENDANT_REF]`.
        var isNodeSelected: boolean = this._isNodeSelected(node);
        var ref: ?string = null;
        if (!foundFirstSelectedDescendant && isNodeSelected) {
          foundFirstSelectedDescendant = true;
          ref = FIRST_SELECTED_DESCENDANT_REF;
        }

        var child = (
          <TreeNodeComponent {...item}
              isExpanded={this._isNodeExpanded}
              isSelected={isNodeSelected}
              labelClassNameForNode={this.props.labelClassNameForNode}
              rowClassNameForNode={this.props.rowClassNameForNode}
              onClickArrow={this._onClickNodeArrow}
              onClick={this._onClickNode}
              onMouseDown={this._onMouseDown}
              key={node.getKey()}
              ref={ref}
          />
        );
        children.push(child);
        allKeys.push(node.getKey());
        keyToNode[node.getKey()] = node;

        // Check whether the node has any children that should be displayed.
        if (!node.isContainer() || !expandedKeys.has(node.getKey())) {
          continue;
        }

        var cachedChildren = node.getCachedChildren();
        if (!cachedChildren || !node.isCacheValid()) {
          promises.push(node.fetchChildren());
        }

        // Prevent flickering by always rendering cached children -- if they're invalid,
        // then the fetch will happen soon.
        if (cachedChildren) {
          var depth = item.depth + 1;
          // Push the node's children on the stack in reverse order so that when
          // they are popped off the stack, they are iterated in the original
          // order.
          cachedChildren.reverse().forEach((childNode) => {
            stack.push({node: childNode, depth});
          });
        }
      }
    });

    if (promises.length) {
      Promise.all(promises).then(() => {
        // The component could have been unmounted by the time the promises are resolved.
        if (this.isMounted()) {
          this.forceUpdate();
        }
      });
    }

    this._allKeys = allKeys;
    this._keyToNode = keyToNode;
    return (
      <div className='nuclide-tree-root'>
        {children}
      </div>
    );
  },

  componentWillMount(): void {
    this._allKeys = [];
    this._keyToNode = {};
    this.state.roots.forEach((root) => {
      var rootKey = root.getKey();
      this._allKeys.push(rootKey);
      this._keyToNode[rootKey] = root;
    });

    this._subscriptions = new CompositeDisposable();

    this._subscriptions.add(atom.commands.add(
        this.props.eventHandlerSelector,
        {
          // Expand and collapse.
          'core:move-right': () => this._expandSelection(),
          'core:move-left': () => this._collapseSelection(),

          // Move selection up and down.
          'core:move-up': () => this._moveSelectionUp(),
          'core:move-down': () => this._moveSelectionDown(),

          'core:confirm': () => this._confirmSelection(),
        }));
  },

  componentWillUnmount(): void {
    if (this._subscriptions) {
      this._subscriptions.dispose();
    }
  },

  serialize(): TreeComponentState {
    var {from} = require('nuclide-commons').array;
    return {
      expandedNodeKeys: from(this.state.expandedKeys),
      selectedNodeKeys: from(this.state.selectedKeys),
    };
  },

  setRoots(roots: Array<LazyTreeNode>): void {
    // Remove old state for roots that are no longer relevant.
    var oldRoots = this.state.roots;
    var rootKeys = new Set(roots.map((root) => root.getKey()));
    oldRoots.forEach((root) => {
      if (!rootKeys.has(root.getKey())) {
        this.removeStateForSubtree(root);
      }
    });

    // Collect the roots, reusing old ones if possible to preserve state.
    roots = roots.map((root) => this.getNodeForKey(root.getKey()) || root);

    var expandedKeys = this.state.expandedKeys;
    roots.forEach((root) => expandedKeys.add(root.getKey()));

    this.setState({
      roots,
      expandedKeys,
    });
  },

  removeStateForSubtree(root: LazyTreeNode): void {
    var expandedKeys = this.state.expandedKeys;
    var selectedKeys = this.state.selectedKeys;

    forEachCachedNode(root, (node) => {
      var cachedKey = node.getKey();
      expandedKeys.delete(cachedKey);
      selectedKeys.delete(cachedKey);
    });

    this.setState({
      expandedKeys,
      selectedKeys,
    });
  },

  getRootNodes(): Array<LazyTreeNode> {
    return this.state.roots;
  },

  getExpandedNodes(): Array<LazyTreeNode> {
    var expandedNodes = [];
    this.state.expandedKeys.forEach(key => {
      var node = this.getNodeForKey(key);
      if (node != null) {
        expandedNodes.push(node);
      }
    });
    return expandedNodes;
  },

  getSelectedNodes(): Array<LazyTreeNode> {
    var selectedNodes = [];
    this.state.selectedKeys.forEach(key => {
      var node = this.getNodeForKey(key);
      if (node != null) {
        selectedNodes.push(this.getNodeForKey(key));
      }
    });
    return selectedNodes;
  },

  // Return the key for the first node that is selected, or null if there are none.
  _getFirstSelectedKey(): ?string {
    if (this.state.selectedKeys.size === 0) {
      return null;
    }

    var selectedKey;
    this._allKeys.every((key) => {
      if (this.state.selectedKeys.has(key)) {
        selectedKey = key;
        return false;
      }
      return true;
    });
    return selectedKey;
  },

  _expandSelection(): void {
    var key = this._getFirstSelectedKey();
    if (key) {
      this.expandNodeKey(key);
    }
  },

  /**
   * Selects a node by key if it's in the file tree; otherwise, do nothing.
   */
  selectNodeKey(nodeKey: string): void {
    if (!this.getNodeForKey(nodeKey)) {
      return;
    }
    this.setState({selectedKeys: new Set([nodeKey])});
  },

  getNodeForKey(nodeKey: string): ?LazyTreeNode {
    return this._keyToNode[nodeKey];
  },

  expandNodeKey(nodeKey: string): void {
    var node = this.getNodeForKey(nodeKey);

    if (node != null) {
      this._toggleNodeExpanded(node, true /* forceExpanded */);
    }
  },

  collapseNodeKey(nodeKey: string): void {
    var node = this.getNodeForKey(nodeKey);

    if (node != null) {
      this._toggleNodeExpanded(node, false /* forceExpanded */);
    }
  },

  isNodeKeyExpanded(nodeKey: string): boolean {
    return this.state.expandedKeys.has(nodeKey);
  },

  _collapseSelection(): void {
    var key = this._getFirstSelectedKey();
    if (!key) {
      return;
    }

    var expandedKeys = this.state.expandedKeys;
    var node = this.getNodeForKey(key);
    if (!expandedKeys.has(key) || (node && !node.isContainer())) {
      // If the selection is already collapsed or it's not a container, select its parent.
      var parent = node.getParent();
      if (parent) {
        this.selectNodeKey(parent.getKey());
      }
    }

    this.collapseNodeKey(key);
  },

  _moveSelectionUp(): void {
    var allKeys = this._allKeys;
    var keyIndexToSelect = allKeys.length - 1;

    var key = this._getFirstSelectedKey();
    if (key) {
      keyIndexToSelect = allKeys.indexOf(key);
      if (keyIndexToSelect > 0) {
        --keyIndexToSelect;
      }
    }
    this.setState({selectedKeys: new Set([allKeys[keyIndexToSelect]])});
  },

  _moveSelectionDown(): void {
    var allKeys = this._allKeys;
    var keyIndexToSelect = 0;

    var key = this._getFirstSelectedKey();
    if (key) {
      keyIndexToSelect = allKeys.indexOf(key);
      if (keyIndexToSelect !== -1 && keyIndexToSelect < allKeys.length - 1) {
        ++keyIndexToSelect;
      }
    }
    this.setState({selectedKeys: new Set([allKeys[keyIndexToSelect]])});
  },

  _confirmSelection(): void {
    var key = this._getFirstSelectedKey();
    if (key) {
      var node = this.getNodeForKey(key);
      this.props.onConfirmSelection(node);
    }
  },
});

module.exports = TreeRootComponent;
