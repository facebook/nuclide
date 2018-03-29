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

import {Directory} from 'atom';
import FileTreeActions from '../lib/FileTreeActions';
import FileTreeHelpers from '../lib/FileTreeHelpers';
import {FileTreeStore} from '../lib/FileTreeStore';
import type {FileTreeNode} from '../lib/FileTreeNode';

import {copyFixture} from '../../nuclide-test-helpers';
import fs from 'fs';
import nuclideUri from 'nuclide-commons/nuclideUri';

import {denodeify} from 'nuclide-commons/promise';

import {buildTempDirTree} from './helpers/BuildTempDirTree';

import tempModule from 'temp';
tempModule.track();
const tempCleanup = denodeify(tempModule.cleanup);

import invariant from 'assert';

class MockRepository {
  isProjectAtRoot() {
    return true;
  }

  isPathIgnored() {
    return true;
  }
}

describe('FileTreeStore', () => {
  let dir1 = '';
  let fooTxt = '';
  let dir2 = '';

  const actions: FileTreeActions = FileTreeActions.getInstance();
  const store: FileTreeStore = FileTreeStore.getInstance();

  /*
   * Trigger the fetch through the **internal-only** API. Enables the
   * tests to await loading children.
   */
  function loadChildKeys(rootKey: string, nodeKey: string): Promise<void> {
    return store._getLoading(nodeKey) || Promise.resolve();
  }

  function getNode(rootKey: string, nodeKey: string): FileTreeNode {
    const node = store.getNode(rootKey, nodeKey);
    invariant(node);
    return node;
  }

  function shownChildren(
    rootKey: string,
    nodeKey: string,
  ): Array<FileTreeNode> {
    const node = getNode(rootKey, nodeKey);
    return node.children
      .filter(n => n.shouldBeShown)
      .valueSeq()
      .toArray();
  }

  function isExpanded(rootKey: string, nodeKey: string): boolean {
    return getNode(rootKey, nodeKey).isExpanded;
  }

  beforeEach(() => {
    waitsForPromise(async () => {
      const tmpFixturesDir = await copyFixture('.', __dirname);
      dir1 = nuclideUri.join(tmpFixturesDir, 'dir1/');
      fooTxt = nuclideUri.join(dir1, 'foo.txt');
      dir2 = nuclideUri.join(tmpFixturesDir, 'dir2/');
    });
  });

  afterEach(() => {
    waitsForPromise(async () => {
      store.reset();
      await tempCleanup();
    });
  });

  it('should be initialized with no root keys', () => {
    const rootKeys = store.getRootKeys();
    expect(Array.isArray(rootKeys)).toBe(true);
    expect(rootKeys.length).toBe(0);
  });

  describe('isEmpty', () => {
    it('returns true when the store is empty, has no roots', () => {
      expect(store.isEmpty()).toBe(true);
    });

    it('returns false when the store has data, has roots', () => {
      actions.setRootKeys([dir1]);
      expect(store.isEmpty()).toBe(false);
    });
  });

  it('should update root keys via actions', () => {
    actions.setRootKeys([dir1, dir2]);
    const rootKeys = store.getRootKeys();
    expect(Array.isArray(rootKeys)).toBe(true);
    expect(rootKeys.join('|')).toBe(`${dir1}|${dir2}`);
  });

  it('should expand root keys as they are added', () => {
    const rootKey = nuclideUri.join(__dirname, 'fixtures') + '/';
    actions.setRootKeys([rootKey]);
    const node = getNode(rootKey, rootKey);
    expect(node.isExpanded).toBe(true);
  });

  it('toggles selected items', () => {
    actions.setRootKeys([dir1]);
    actions.setSelectedNode(dir1, dir1);
    let node = getNode(dir1, dir1);
    expect(node.isSelected()).toBe(true);
    actions.unselectNode(dir1, dir1);
    node = getNode(dir1, dir1);
    expect(node.isSelected()).toBe(false);
  });

  it('deselects items in other roots when a single node is selected', () => {
    actions.setRootKeys([dir1, dir2]);
    actions.setSelectedNode(dir1, dir1);
    let node1 = getNode(dir1, dir1);
    let node2 = getNode(dir2, dir2);

    // Node 1 is selected, node 2 is not selected
    expect(node1.isSelected()).toBe(true);
    expect(node2.isSelected()).toBe(false);

    // Selecting a single node, node2, deselects nodes in all other roots
    actions.setSelectedNode(dir2, dir2);
    node1 = getNode(dir1, dir1);
    node2 = getNode(dir2, dir2);
    expect(node1.isSelected()).toBe(false);
    expect(node2.isSelected()).toBe(true);
  });

  describe('getSelectedNodes', () => {
    it('returns selected nodes from all roots', () => {
      actions.setRootKeys([dir1, dir2]);
      actions.addSelectedNode(dir1, dir1);
      actions.addSelectedNode(dir2, dir2);

      // Convert the `Immutable.Set` to a native `Array` for simpler use w/ Jasmine.
      const selectedNodes = store
        .getSelectedNodes()
        .map(node => node.uri)
        .toArray();
      expect(selectedNodes).toEqual([dir1, dir2]);
    });

    it('returns an empty Set when no nodes are selected', () => {
      const selectedNodes = store
        .getSelectedNodes()
        .map(node => node.uri)
        .toArray();
      expect(selectedNodes).toEqual([]);
    });
  });

  describe('getSingleSelectedNode', () => {
    beforeEach(() => {
      /*
       * Create two roots. It'll look like the following:
       *
       *   → dir1
       *   → dir2
       */
      actions.setRootKeys([dir1, dir2]);
    });

    it('returns null when no nodes are selected', () => {
      expect(store.getSingleSelectedNode()).toBeNull();
    });

    it('returns null when more than 1 node is selected', () => {
      actions.addSelectedNode(dir1, dir1);
      actions.addSelectedNode(dir2, dir2);
      expect(store.getSingleSelectedNode()).toBeNull();
    });

    it('returns a node when only 1 is selected', () => {
      actions.setSelectedNode(dir2, dir2);
      const singleSelectedNode = store.getSingleSelectedNode();
      expect(singleSelectedNode).not.toBeNull();
      invariant(singleSelectedNode);
      expect(singleSelectedNode.uri).toEqual(dir2);
    });
  });

  describe('getRootForPath', () => {
    beforeEach(() => {
      waitsForPromise(async () => {
        actions.setRootKeys([dir1, dir2]);
        actions.expandNode(dir1, fooTxt);
        await loadChildKeys(dir1, dir1);
      });
    });

    it('returns null if path does not belong to any root', () => {
      expect(store.getRootForPath('random/path/file.txt')).toBeNull();
    });

    it('returns a root node if path exists in a root', () => {
      const node = store.getRootForPath(fooTxt);
      expect(node).not.toBeNull();
      invariant(node);
      expect(node.uri).toEqual(dir1);
    });
  });

  describe('trackedNode', () => {
    it('resets when there is a new selection', () => {
      actions.setRootKeys([dir1]);
      actions.setTrackedNode(dir1, dir1);

      // Root is tracked after setting it.
      const trackedNode = store.getTrackedNode();
      expect(trackedNode && trackedNode.uri).toBe(dir1);
      actions.setSelectedNode(dir1, dir1);

      // New selection, which happens on user interaction via select and collapse, resets the
      // tracked node.
      expect(store.getTrackedNode()).toBe(getNode(dir1, dir1));
    });
  });

  describe('getChildKeys', () => {
    it("clears loading and expanded states when there's an error fetching children", () => {
      waitsForPromise(async () => {
        spyOn(FileTreeHelpers, 'fetchChildren').andCallFake(() => {
          return Promise.reject(new Error('This error **should** be thrown.'));
        });

        actions.setRootKeys([dir1]);

        let node = getNode(dir1, dir1);
        expect(node.isExpanded).toBe(true);
        expect(node.isLoading).toBe(true);

        try {
          await loadChildKeys(dir1, dir1);
        } catch (e) {
          // This will always throw an exception, but that's irrelevant to this test. The side
          // effects after this try/catch capture the purpose of this test.
        }

        node = getNode(dir1, dir1);
        expect(node.isExpanded).toBe(false);
        expect(node.isLoading).toBe(false);
      });
    });
  });

  describe('this._filter', () => {
    let node;

    beforeEach(() => {
      actions.setRootKeys([dir1]);
      node = getNode(dir1, dir1);
    });

    function checkNode(name, matches) {
      node = getNode(dir1, dir1);
      expect(node.highlightedText).toEqual(name);
      expect(node.matchesFilter).toEqual(matches);
    }

    function updateFilter() {
      expect(store.getFilter()).toEqual('');
      actions.setRootKeys([dir1]);
      checkNode('', true);
      store.addFilterLetter(node.name);
      expect(store.getFilter()).toEqual(node.name);
      checkNode(node.name, true);
    }

    function doubleFilter() {
      updateFilter();
      store.addFilterLetter(node.name);
      expect(store.getFilter()).toEqual(node.name + node.name);
      checkNode('', false);
    }

    function clearFilter() {
      updateFilter();
      store.addFilterLetter('t');
      checkNode('', false);
      store.clearFilter();
      checkNode('', true);
    }

    it('should update when a letter is added', () => {
      updateFilter();
      store.clearFilter();
    });

    it('should not match when filter does not equal name', () => {
      doubleFilter();
      store.clearFilter();
    });

    it('should clear the filter, and return matching to normal', () => {
      node = getNode(dir1, dir1);
      clearFilter();
    });

    it('should remove filter letter', () => {
      updateFilter();
      store.removeFilterLetter();
      checkNode(node.name.substr(0, node.name.length - 1), true);
      store.clearFilter();
    });
  });

  it('omits hidden nodes', () => {
    waitsForPromise(async () => {
      actions.setRootKeys([dir1]);
      actions.expandNode(dir1, fooTxt);
      actions.setIgnoredNames(['foo.*']);

      await loadChildKeys(dir1, dir1);

      expect(shownChildren(dir1, dir1).length).toBe(0);
    });
  });

  it('shows nodes if the pattern changes to no longer match', () => {
    waitsForPromise(async () => {
      actions.setRootKeys([dir1]);
      actions.expandNode(dir1, fooTxt);
      actions.setIgnoredNames(['foo.*']);

      await loadChildKeys(dir1, dir1);

      actions.setIgnoredNames(['bar.*']);

      expect(shownChildren(dir1, dir1).length).toBe(1);
    });
  });

  it('obeys the hideIgnoredNames setting', () => {
    waitsForPromise(async () => {
      actions.setRootKeys([dir1]);
      actions.expandNode(dir1, fooTxt);
      actions.setIgnoredNames(['foo.*']);
      actions.setHideIgnoredNames(false);

      await loadChildKeys(dir1, dir1);

      expect(shownChildren(dir1, dir1).length).toBe(1);
    });
  });

  describe('recovering from failed subscriptions', () => {
    it('fetches children on re-expansion of failed directories', () => {
      waitsForPromise(async () => {
        const unsubscribeableDir = new Directory(dir1);
        // Force subscription to fail to mimic network failure, etc.
        spyOn(unsubscribeableDir, 'onDidChange').andCallFake(() => {
          throw new Error('This error **should** be thrown.');
        });

        // Return the always-fail directory when it is expanded.
        spyOn(FileTreeHelpers, 'getDirectoryByKey').andReturn(
          unsubscribeableDir,
        );

        actions.setRootKeys([dir1]);
        actions.expandNode(dir1, dir1);
        await loadChildKeys(dir1, dir1);

        // Children should load but the subscription should fail.
        expect(shownChildren(dir1, dir1).map(n => n.uri)).toEqual([fooTxt]);

        // Add a new file, 'bar.baz', for which the store will not get a notification because
        // the subscription failed.
        const barBaz = nuclideUri.join(dir1, 'bar.baz');
        fs.writeFileSync(barBaz, '');
        await loadChildKeys(dir1, dir1);
        expect(shownChildren(dir1, dir1).map(n => n.uri)).toEqual([fooTxt]);

        // Collapsing and re-expanding a directory should forcibly fetch its children regardless of
        // whether a subscription is possible.
        actions.collapseNode(dir1, dir1);
        actions.expandNode(dir1, dir1);
        await loadChildKeys(dir1, dir1);

        // The subscription should fail again, but the children should be refetched and match the
        // changed structure (i.e. include the new 'bar.baz' file).
        expect(shownChildren(dir1, dir1).map(n => n.uri)).toEqual([
          barBaz,
          fooTxt,
        ]);
      });
    });
  });

  it('omits vcs-excluded paths', () => {
    waitsForPromise(async () => {
      actions.setRootKeys([dir1]);
      actions.expandNode(dir1, fooTxt);
      actions.setExcludeVcsIgnoredPaths(true);
      actions.setHideVcsIgnoredPaths(true);

      const mockRepo = new MockRepository();
      store._updateConf(conf => {
        conf.reposByRoot[dir1] = (mockRepo: any);
      });

      await loadChildKeys(dir1, dir1);
      expect(shownChildren(dir1, dir1).length).toBe(0);
    });
  });

  it('includes vcs-excluded paths when told to', () => {
    waitsForPromise(async () => {
      actions.setRootKeys([dir1]);
      actions.expandNode(dir1, fooTxt);
      actions.setExcludeVcsIgnoredPaths(false);
      actions.setHideVcsIgnoredPaths(false);

      const mockRepo = new MockRepository();
      store._updateConf(conf => {
        conf.reposByRoot[dir1] = (mockRepo: any);
      });

      await loadChildKeys(dir1, dir1);
      expect(shownChildren(dir1, dir1).length).toBe(1);
    });
  });

  it('includes vcs-excluded paths when explicitly told to', () => {
    waitsForPromise(async () => {
      actions.setRootKeys([dir1]);
      actions.expandNode(dir1, fooTxt);
      actions.setExcludeVcsIgnoredPaths(true);
      actions.setHideVcsIgnoredPaths(false);

      const mockRepo = new MockRepository();
      store._updateConf(conf => {
        conf.reposByRoot[dir1] = (mockRepo: any);
      });

      await loadChildKeys(dir1, dir1);
      expect(shownChildren(dir1, dir1).length).toBe(1);
    });
  });

  it('expands deep nested structure of the node', () => {
    waitsForPromise(async () => {
      const map: Map<string, string> = await buildTempDirTree(
        'dir3/dir31/foo31.txt',
        'dir3/dir32/bar32.txt',
      );
      const dir3 = map.get('dir3');
      const dir31 = map.get('dir3/dir31');
      // flowlint-next-line sketchy-null-string:off
      invariant(dir3 && dir31);
      actions.setRootKeys([dir3]);

      // Await **internal-only** API because the public `expandNodeDeep` API does not
      // return the promise that can be awaited on
      await store._expandNodeDeep(dir3, dir3);

      expect(shownChildren(dir3, dir31).length).toBe(1);
    });
  });

  it('collapses deep nested structore', () => {
    waitsForPromise(async () => {
      const map: Map<string, string> = await buildTempDirTree(
        'dir3/dir31/foo31.txt',
        'dir3/dir32/bar32.txt',
      );
      const dir3 = map.get('dir3');
      const dir31 = map.get('dir3/dir31');
      // flowlint-next-line sketchy-null-string:off
      invariant(dir3 && dir31);
      actions.setRootKeys([dir3]);

      // Await **internal-only** API because the public `expandNodeDeep` API does not
      // return the promise that can be awaited on
      await store._expandNodeDeep(dir3, dir3);
      expect(isExpanded(dir3, dir31)).toBe(true);
      actions.collapseNodeDeep(dir3, dir3);
      expect(isExpanded(dir3, dir31)).toBe(false);
    });
  });

  it('stops expanding after adding 100 items to the tree in BFS order', () => {
    waitsForPromise(async () => {
      const arrFiles = [];
      for (let i = 0; i < 100; i++) {
        arrFiles.push(`dir3/dir31/foo${i}.txt`);
      }
      arrFiles.push('dir3/dir32/bar.txt');

      const map: Map<string, string> = await buildTempDirTree(...arrFiles);
      const dir3 = map.get('dir3');
      const dir31 = map.get('dir3/dir31');
      const dir32 = map.get('dir3/dir32');
      // flowlint-next-line sketchy-null-string:off
      invariant(dir3 && dir31 && dir32);
      actions.setRootKeys([dir3]);

      // Await **internal-only** API because the public `expandNodeDeep` API does not
      // return the promise that can be awaited on
      await store._expandNodeDeep(dir3, dir3);
      expect(isExpanded(dir3, dir31)).toBe(true);
      expect(isExpanded(dir3, dir32)).toBe(false);
    });
  });

  it('should be able to add, remove, then re-add a file', () => {
    const foo2Txt = nuclideUri.join(dir1, 'foo2.txt');

    waitsForPromise(async () => {
      actions.setRootKeys([dir1]);
      actions.expandNode(dir1, dir1);
      await loadChildKeys(dir1, dir1);
      fs.writeFileSync(foo2Txt, '');
    });

    // Wait for the new file to be loaded.
    waitsFor(() => store.getNode(dir1, foo2Txt));

    runs(() => {
      // Ensure the child did not inherit the parent subscription.
      const child = getNode(dir1, foo2Txt);
      expect(child.subscription).toBe(null);
      fs.unlinkSync(foo2Txt);
    });

    // Ensure that file disappears from the tree.
    waitsFor(() => store.getNode(dir1, foo2Txt) == null);

    // Add the file back.
    runs(() => {
      fs.writeFileSync(foo2Txt, '');
    });

    // Wait for the new file to be loaded.
    waitsFor(() => store.getNode(dir1, foo2Txt));
  });
});
