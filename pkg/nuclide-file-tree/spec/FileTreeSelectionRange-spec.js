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

import {
  RangeKey,
  SelectionRange,
  RangeUtil,
} from '../lib/FileTreeSelectionRange';

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import {FileTreeNode} from '../lib/FileTreeNode';
import FileTreeActions from '../lib/FileTreeActions';
import {FileTreeStore} from '../lib/FileTreeStore';
import {DEFAULT_CONF} from '../lib/FileTreeStore';
import {WorkingSet} from '../../nuclide-working-sets-common';

import {denodeify} from 'nuclide-commons/promise';
import {buildTempDirTree} from './helpers/BuildTempDirTree';
import tempModule from 'temp';
tempModule.track();
const tempCleanup = denodeify(tempModule.cleanup);

import invariant from 'assert';

describe('FileTreeSelectionRange', () => {
  function createNode(rootUri: NuclideUri, uri: NuclideUri): FileTreeNode {
    return new FileTreeNode({rootUri, uri}, DEFAULT_CONF);
  }

  describe('RangeKey', () => {
    it('properly construct the object', () => {
      const key = new RangeKey('a', 'b');
      expect(key.rootKey() === 'a').toBe(true);
      expect(key.nodeKey() === 'b').toBe(true);
    });

    it('properly construct with factory method', () => {
      const node = createNode('a', 'b');
      const key = RangeKey.of(node);
      expect(key.rootKey() === 'a').toBe(true);
      expect(key.nodeKey() === 'b').toBe(true);
    });

    it('properly test equality', () => {
      const key1 = new RangeKey('a', 'b');
      const key2 = new RangeKey('a', 'b');
      expect(key1 === key2).toBe(false);
      expect(key1).toEqual(key2);
      expect(key1.equals(key2)).toBe(true);
    });
  });

  describe('SelectionRange', () => {
    const key1 = new RangeKey('a', '1');
    const key2 = new RangeKey('a', '2');
    const key3 = new RangeKey('a', '3');

    it('properly construct the object', () => {
      const range = new SelectionRange(key1, key2);
      expect(range.anchor().equals(key1)).toBe(true);
      expect(range.range().equals(key2)).toBe(true);

      describe('factory method', () => {
        it('properly construct new object based on existing ones', () => {
          const range2 = range.withNewRange(key2);
          expect(range2.anchor().equals(key1)).toBe(true);
          expect(range2.range().equals(key2)).toBe(true);
          const range3 = range.withNewAnchor(key3);
          expect(range3.anchor().equals(key3)).toBe(true);
          expect(range3.range().equals(key2)).toBe(true);
          const range4 = SelectionRange.ofSingleItem(key2);
          expect(range4.anchor().equals(key2)).toBe(true);
          expect(range4.range().equals(key2)).toBe(true);
        });
      });
    });

    it('properly test equality', () => {
      const range1 = new SelectionRange(key1, key2);
      const range2 = new SelectionRange(key1, key2);
      expect(range1.equals(range2)).toBe(true);
    });
  });

  describe('RangeUtil', () => {
    const actions: FileTreeActions = FileTreeActions.getInstance();
    const store: FileTreeStore = FileTreeStore.getInstance();

    async function prepareFileTree(): Promise<Map<string, string>> {
      const map: Map<string, string> = await buildTempDirTree(
        'dir/foo/foo1',
        'dir/foo/foo2',
        'dir/bar/bar1',
        'dir/bar/bar2',
        'dir/bar/bar3',
      );
      const dir = map.get('dir');
      invariant(dir);
      actions.setRootKeys([dir]);
      return map;
    }

    let map: Map<string, string> = new Map();

    beforeEach(() => {
      waitsForPromise(async () => {
        map = await prepareFileTree();
        const dir = map.get('dir');
        invariant(dir);
        // Await **internal-only** API because the public `expandNodeDeep` API does not
        // return the promise that can be awaited on
        await store._expandNodeDeep(dir, dir);
      });
    });

    afterEach(() => {
      waitsForPromise(async () => {
        actions.updateWorkingSet(new WorkingSet([]));
        store.reset();
        await tempCleanup();
      });
    });

    describe('findSelectedNode', () => {
      it('returns the node itself if it is shown and selected', () => {
        const dir = map.get('dir');
        const bar1 = map.get('dir/bar/bar1');
        invariant(dir);
        invariant(bar1);
        actions.setSelectedNode(dir, bar1);
        const node = store.getNode(dir, bar1);
        invariant(node);
        expect(RangeUtil.findSelectedNode(node)).toBe(node);
      });

      it('searches the next selected node if passed in node is unselected', () => {
        const dir = map.get('dir');
        const bar1 = map.get('dir/bar/bar1');
        const bar3 = map.get('dir/bar/bar3');
        invariant(dir);
        invariant(bar1);
        invariant(bar3);
        actions.setSelectedNode(dir, bar3);
        const node = store.getNode(dir, bar1);
        invariant(node);
        expect(RangeUtil.findSelectedNode(node)).toBe(store.getNode(dir, bar3));
      });

      it('searches the prev selected node if nothing else is selected', () => {
        const dir = map.get('dir');
        const bar1 = map.get('dir/bar/bar1');
        const bar3 = map.get('dir/bar/bar3');
        invariant(dir);
        invariant(bar1);
        invariant(bar3);
        actions.setSelectedNode(dir, bar1);
        const node = store.getNode(dir, bar3);
        invariant(node);
        expect(RangeUtil.findSelectedNode(node)).toBe(store.getNode(dir, bar1));
      });

      it('returns null if nothing is selected', () => {
        const dir = map.get('dir');
        const bar1 = map.get('dir/bar/bar1');
        invariant(dir);
        invariant(bar1);
        const node = store.getNode(dir, bar1);
        invariant(node);
        expect(RangeUtil.findSelectedNode(node)).toBe(null);
      });

      it('searches the next selected node if itself is not shown', () => {
        const dir = map.get('dir');
        const foo = map.get('dir/foo');
        const foo1 = map.get('dir/foo/foo1');
        const bar1 = map.get('dir/bar/bar1');
        invariant(dir);
        invariant(foo);
        invariant(foo1);
        invariant(bar1);
        actions.collapseNode(dir, foo);
        actions.setSelectedNode(dir, bar1);
        const node = store.getNode(dir, foo1);
        invariant(node);
        expect(RangeUtil.findSelectedNode(node)).toBe(store.getNode(dir, bar1));
      });

      it('only searches the selected node within the working set', () => {
        const dir = map.get('dir');
        const foo1 = map.get('dir/foo/foo1');
        const bar1 = map.get('dir/bar/bar1');
        invariant(dir);
        invariant(foo1);
        invariant(bar1);
        actions.updateWorkingSet(new WorkingSet([foo1, bar1]));
        actions.setSelectedNode(dir, bar1);
        const node = store.getNode(dir, foo1);
        invariant(node);
        expect(RangeUtil.findSelectedNode(node)).toBe(store.getNode(dir, bar1));
      });
    });
  });
});
