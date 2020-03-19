/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
import {FileTreeNode} from '../lib/FileTreeNode';
import * as Immutable from 'immutable';

describe('FileTreeNode', () => {
  it('properly sets the default properties', () => {
    const node = new FileTreeNode({uri: '/abc/def', rootUri: '/abc/'});

    expect(node.uri).toBe('/abc/def');
    expect(node.rootUri).toBe('/abc/');
    expect(node.isExpanded).toBe(false);
    expect(node.isLoading).toBe(false);
    expect(node.isCwd).toBe(false);
    expect(node.children.isEmpty()).toBe(true);
    expect(node.highlightedText).toEqual('');
    expect(node.matchesFilter).toBeTruthy();
  });

  it('properly sets the supplied properties', () => {
    const children = Immutable.OrderedMap();
    const node = new FileTreeNode({
      uri: '/abc/def',
      rootUri: '/abc/',
      isExpanded: true,
      isLoading: true,
      isCwd: true,
      children,
    });

    expect(node.uri).toBe('/abc/def');
    expect(node.rootUri).toBe('/abc/');
    expect(node.isExpanded).toBe(true);
    expect(node.isLoading).toBe(true);
    expect(node.isCwd).toBe(true);
    expect(node.children).toBe(children);
    expect(node.highlightedText).toEqual('');
    expect(node.matchesFilter).toBeTruthy();
  });

  it('preserves instance on non-modifying updates', () => {
    const child1 = new FileTreeNode({uri: '/abc/def/ghi1', rootUri: '/abc/'});
    const child2 = new FileTreeNode({uri: '/abc/def/ghi2', rootUri: '/abc/'});
    const children = Immutable.OrderedMap([
      [child1.name, child1],
      [child2.name, child2],
    ]);
    const node = new FileTreeNode({
      uri: '/abc/def',
      rootUri: '/abc/',
      isExpanded: true,
      isLoading: false,
      isCwd: true,
      children,
    });

    expect(node.isExpanded).toBe(true);
    let updatedNode = node.setIsExpanded(true);
    expect(updatedNode).toBe(node);
    updatedNode = node.setIsLoading(false);
    expect(updatedNode).toBe(node);
    updatedNode = node.setIsCwd(true);
    expect(updatedNode).toBe(node);
    updatedNode = node.setChildren(Immutable.OrderedMap(children));
    expect(updatedNode).toBe(node);
    updatedNode = node.setRecursive(null, child => child.setIsLoading(false));
    expect(updatedNode).toBe(node);
    updatedNode = node.set({
      isExpanded: true,
      isLoading: false,
      isCwd: true,
      children,
    });
    expect(updatedNode).toBe(node);

    updatedNode = node.updateChild(child2.setIsExpanded(false));
    expect(updatedNode).toBe(node);
  });

  it('finds nodes', () => {
    const rootUri = '/r/';
    const nodeABC = new FileTreeNode({uri: '/r/A/B/C/', rootUri});
    const nodeABD = new FileTreeNode({uri: '/r/A/B/D/', rootUri});
    let children = FileTreeNode.childrenFromArray([nodeABC, nodeABD]);
    const nodeAB = new FileTreeNode({uri: '/r/A/B/', rootUri, children});
    children = FileTreeNode.childrenFromArray([nodeAB]);
    const nodeA = new FileTreeNode({uri: '/r/A/', rootUri, children});
    const nodeB = new FileTreeNode({uri: '/r/B/', rootUri});
    children = FileTreeNode.childrenFromArray([nodeA, nodeB]);
    const root = new FileTreeNode({uri: '/r/', rootUri, children});

    expect(root.find('/r/')).toBe(root);
    expect(root.find('/r/A/')).toBe(nodeA);
    expect(root.find('/r/B/')).toBe(nodeB);
    expect(root.find('/r/A/B/')).toBe(nodeAB);
    expect(root.find('/r/A/B/C/')).toBe(nodeABC);
    expect(root.find('/r/A/B/D/')).toBe(nodeABD);

    expect(root.findDeepest('/r/A/B/E/')).toBe(nodeAB);
    expect(root.findDeepest('/r/A/B/C/E/')).toBe(nodeABC);
    expect(root.findDeepest('/r/B/B/C/E/')).toBe(nodeB);
    expect(root.findDeepest('/r/C/B/C/E/')).toBe(root);

    expect(root.find('/r/A/B/E/')).toBe(null);
    expect(root.findDeepest('/nonRoot/C/B/C/E/')).toBe(null);
  });
});
