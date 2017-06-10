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

import type {LazyTreeNode} from '../LazyTreeNode';

import {LazyTestTreeNode} from './LazyTestTreeNode';
import invariant from 'assert';

describe('LazyTreeNode', () => {
  it('caches the fetched children', () => {
    waitsForPromise(async () => {
      let children = null;
      async function fetchChildren(
        parentNode: LazyTreeNode,
      ): Promise<Array<LazyTreeNode>> {
        children = [
          new LazyTestTreeNode({label: 'B'}, /* parent */ parentNode, false),
          new LazyTestTreeNode({label: 'C'}, /* parent */ parentNode, false),
        ];
        return children;
      }
      const node = new LazyTestTreeNode(
        {label: 'A'},
        /* parent */ null,
        true,
        fetchChildren,
      );

      expect(await node.fetchChildren()).toEqual(children);
      expect(node.getCachedChildren()).toEqual(children);
    });
  });

  describe('isRoot', () => {
    it('returns true for a root', () => {
      waitsForPromise(async () => {
        let children = null;
        async function fetchChildren(
          parentNode: LazyTreeNode,
        ): Promise<Array<LazyTreeNode>> {
          children = [
            new LazyTestTreeNode({label: 'B'}, /* parent */ parentNode, false),
            new LazyTestTreeNode({label: 'C'}, /* parent */ parentNode, false),
          ];
          return children;
        }
        const node = new LazyTestTreeNode(
          {label: 'A'},
          /* parent */ null,
          true,
          fetchChildren,
        );
        expect(await node.fetchChildren()).toEqual(children);
        expect(node.isRoot()).toBe(true);
      });
    });
    it('returns false for a fetched, non-root node', () => {
      waitsForPromise(async () => {
        let children = null;
        async function fetchChildren(
          parentNode: LazyTreeNode,
        ): Promise<Array<LazyTreeNode>> {
          children = [
            new LazyTestTreeNode({label: 'B'}, /* parent */ parentNode, false),
            new LazyTestTreeNode({label: 'C'}, /* parent */ parentNode, false),
          ];
          return children;
        }
        const node = new LazyTestTreeNode(
          {label: 'A'},
          /* parent */ null,
          true,
          fetchChildren,
        );
        expect(await node.fetchChildren()).toEqual(children);
        const cachedChildren = node.getCachedChildren();
        invariant(cachedChildren);
        expect(cachedChildren[0].isRoot()).toBe(false);
      });
    });
  });
});
