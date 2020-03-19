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

import type {FileTreeNode} from '../lib/FileTreeNode';
import type {AppState} from '../lib/types';

import {Directory} from 'atom';
import {WorkingSet} from '../../nuclide-working-sets-common';
import * as FileTreeHelpers from '../lib/FileTreeHelpers';
import createStore from '../lib/redux/createStore';
import * as Selectors from '../lib/redux/Selectors';
import * as Actions from '../lib/redux/Actions';
import * as EpicHelpers from '../lib/redux/EpicHelpers';
import * as Immutable from 'immutable';

import {copyFixture} from '../../nuclide-test-helpers';
import fs from 'fs';
import nuclideUri from 'nuclide-commons/nuclideUri';
import path from 'path';
import waitsFor from '../../../jest/waits_for';

import {denodeify} from 'nuclide-commons/promise';

import {buildTempDirTree} from '../__mocks__/helpers/BuildTempDirTree';

import tempModule from 'temp';
tempModule.track();
const tempCleanup = denodeify(tempModule.cleanup);

import invariant from 'assert';

class MockRepository {
  _workingDirectory: string;

  constructor(workingDirectory: string) {
    this._workingDirectory = workingDirectory;
  }

  getWorkingDirectory = () => this._workingDirectory;

  isProjectAtRoot() {
    return true;
  }

  isPathIgnored() {
    return true;
  }
}

let dir1 = '';
let fooTxt = '';
let dir2 = '';

/*
   * Trigger the fetch through the **internal-only** API. Enables the
   * tests to await loading children.
   */
function loadChildKeys(rootKey: string, nodeKey: string): Promise<void> {
  return Selectors.getLoading(store.getState(), nodeKey) || Promise.resolve();
}

function getNode(rootKey: string, nodeKey: string): FileTreeNode {
  const node = Selectors.getNode(store.getState(), rootKey, nodeKey);
  invariant(node);
  return node;
}

function shownChildren(
  state: AppState,
  rootKey: string,
  nodeKey: string,
): Array<FileTreeNode> {
  const node = getNode(rootKey, nodeKey);
  return node.children
    .filter(n => Selectors.getNodeShouldBeShown(state)(n))
    .valueSeq()
    .toArray();
}

function isExpanded(rootKey: string, nodeKey: string): boolean {
  return getNode(rootKey, nodeKey).isExpanded;
}

function isSelected(rootKey: string, nodeKey: string): boolean {
  return Selectors.getNodeIsSelected(store.getState())(
    getNode(rootKey, nodeKey),
  );
}
function numSelected(): number {
  return Selectors.getSelectedNodes(store.getState()).size;
}

let store;
beforeEach(async () => {
  store = createStore();

  await tempCleanup();
  jest.clearAllMocks();
  jest.resetAllMocks();
  const tmpFixturesDir = await copyFixture(
    '.',
    path.resolve(__dirname, '../__mocks__'),
  );
  dir1 = nuclideUri.join(tmpFixturesDir, 'dir1/');
  fooTxt = nuclideUri.join(dir1, 'foo.txt');
  dir2 = nuclideUri.join(tmpFixturesDir, 'dir2/');

  // The store uses the currently active file to decide when and what to reveal in the file
  // tree when revealActiveFile is called. Importantly, it also short-circuits in some cases if
  // the path is null or undefined. Here we mock it out so that we get normal behavior in our
  // tests.
  jest.spyOn(atom.workspace, 'getActiveTextEditor').mockReturnValue({
    getPath() {
      return 'foo';
    },
  });
});

it('should be initialized with no root keys', () => {
  const rootKeys = Selectors.getRootKeys(store.getState());
  expect(Array.isArray(rootKeys)).toBe(true);
  expect(rootKeys.length).toBe(0);
});

describe('isEmpty', () => {
  it('returns true when the store is empty, has no roots', () => {
    expect(Selectors.isEmpty(store.getState())).toBe(true);
  });

  it('returns false when the store has data, has roots', () => {
    EpicHelpers.setRootKeys(store, [dir1]);
    expect(Selectors.isEmpty(store.getState())).toBe(false);
  });
});

it('should update root keys via actions', () => {
  EpicHelpers.setRootKeys(store, [dir1, dir2]);
  const rootKeys = Selectors.getRootKeys(store.getState());
  expect(Array.isArray(rootKeys)).toBe(true);
  expect(rootKeys.join('|')).toBe(`${dir1}|${dir2}`);
});

it('should expand root keys as they are added', () => {
  const rootKey = nuclideUri.join(__dirname, 'fixtures') + '/';
  EpicHelpers.setRootKeys(store, [rootKey]);
  const node = getNode(rootKey, rootKey);
  expect(node.isExpanded).toBe(true);
});

it('toggles selected items', () => {
  EpicHelpers.setRootKeys(store, [dir1]);
  store.dispatch(Actions.setSelectedNode(dir1, dir1));
  let node = getNode(dir1, dir1);
  expect(Selectors.getNodeIsSelected(store.getState())(node)).toBe(true);
  store.dispatch(Actions.unselectNode(dir1, dir1));
  node = getNode(dir1, dir1);
  expect(Selectors.getNodeIsSelected(store.getState())(node)).toBe(false);
});

it('deselects items in other roots when a single node is selected', () => {
  EpicHelpers.setRootKeys(store, [dir1, dir2]);
  store.dispatch(Actions.setSelectedNode(dir1, dir1));
  let node1 = getNode(dir1, dir1);
  let node2 = getNode(dir2, dir2);

  // Node 1 is selected, node 2 is not selected
  expect(Selectors.getNodeIsSelected(store.getState())(node1)).toBe(true);
  expect(Selectors.getNodeIsSelected(store.getState())(node2)).toBe(false);

  // Selecting a single node, node2, deselects nodes in all other roots
  store.dispatch(Actions.setSelectedNode(dir2, dir2));
  node1 = getNode(dir1, dir1);
  node2 = getNode(dir2, dir2);
  expect(Selectors.getNodeIsSelected(store.getState())(node1)).toBe(false);
  expect(Selectors.getNodeIsSelected(store.getState())(node2)).toBe(true);
});

describe('getSelectedNodes', () => {
  it('returns selected nodes from all roots', () => {
    EpicHelpers.setRootKeys(store, [dir1, dir2]);
    store.dispatch(Actions.addSelectedNode(dir1, dir1));
    store.dispatch(Actions.addSelectedNode(dir2, dir2));

    // Convert the `Immutable.Set` to a native `Array` for simpler use w/ Jasmine.
    const selectedNodes = Selectors.getSelectedNodes(store.getState())
      .map(node => node.uri)
      .toArray();
    expect(selectedNodes).toEqual([dir1, dir2]);
  });

  it('returns an empty Set when no nodes are selected', () => {
    const selectedNodes = Selectors.getSelectedNodes(store.getState())
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
    EpicHelpers.setRootKeys(store, [dir1, dir2]);
  });

  it('returns null when no nodes are selected', () => {
    expect(Selectors.getSingleSelectedNode(store.getState())).toBeNull();
  });

  it('returns null when more than 1 node is selected', () => {
    store.dispatch(Actions.addSelectedNode(dir1, dir1));
    store.dispatch(Actions.addSelectedNode(dir2, dir2));
    expect(Selectors.getSingleSelectedNode(store.getState())).toBeNull();
  });

  it('returns a node when only 1 is selected', () => {
    store.dispatch(Actions.setSelectedNode(dir2, dir2));
    const singleSelectedNode = Selectors.getSingleSelectedNode(
      store.getState(),
    );
    expect(singleSelectedNode).not.toBeNull();
    invariant(singleSelectedNode);
    expect(singleSelectedNode.uri).toEqual(dir2);
  });
});

describe('getRootForPath', () => {
  beforeEach(async () => {
    EpicHelpers.setRootKeys(store, [dir1, dir2]);
    store.dispatch(Actions.expandNode(dir1, fooTxt));
    await loadChildKeys(dir1, dir1);
  });

  it('returns null if path does not belong to any root', () => {
    expect(
      Selectors.getRootForPath(store.getState(), 'random/path/file.txt'),
    ).toBeNull();
  });

  it('returns a root node if path exists in a root', () => {
    const node = Selectors.getRootForPath(store.getState(), fooTxt);
    expect(node).not.toBeNull();
    invariant(node);
    expect(node.uri).toEqual(dir1);
  });
});

describe('trackedNode', () => {
  it('resets when there is a new selection', () => {
    EpicHelpers.setRootKeys(store, [dir1]);
    store.dispatch(Actions.setTrackedNode(dir1, dir1));

    // Root is tracked after setting it.
    const trackedNode = Selectors.getTrackedNode(store.getState());
    expect(trackedNode && trackedNode.uri).toBe(dir1);
    store.dispatch(Actions.setSelectedNode(dir1, dir1));

    // New selection, which happens on user interaction via select and collapse, resets the
    // tracked node.
    expect(Selectors.getTrackedNode(store.getState())).toBe(
      getNode(dir1, dir1),
    );
  });
});

describe('getChildKeys', () => {
  it("clears loading and expanded states when there's an error fetching children", async () => {
    jest.spyOn(FileTreeHelpers, 'fetchChildren').mockImplementation(() => {
      return Promise.reject(new Error('This error **should** be thrown.'));
    });

    EpicHelpers.setRootKeys(store, [dir1]);

    let node = getNode(dir1, dir1);
    expect(node.isExpanded).toBe(true);
    expect(node.isLoading).toBe(true);

    try {
      await loadChildKeys(dir1, dir1);
    } catch (e) {
      // This will always throw an exception, but that's irrelevant to this test. The side
      // effects after this try/catch capture the purpose of this test.
    } finally {
      // $FlowFixMe
      FileTreeHelpers.fetchChildren.mockRestore();
    }

    node = getNode(dir1, dir1);
    expect(node.isExpanded).toBe(false);
    expect(node.isLoading).toBe(false);
  });
});

describe('filter', () => {
  let node;

  beforeEach(() => {
    EpicHelpers.setRootKeys(store, [dir1]);
    node = getNode(dir1, dir1);
  });

  function checkNode(name, matches) {
    node = getNode(dir1, dir1);
    expect(node.highlightedText).toEqual(name);
    expect(node.matchesFilter).toEqual(matches);
  }

  function updateFilter() {
    expect(Selectors.getFilter(store.getState())).toEqual('');
    EpicHelpers.setRootKeys(store, [dir1]);
    checkNode('', true);
    store.dispatch(Actions.addFilterLetter(node.name));
    expect(Selectors.getFilter(store.getState())).toEqual(node.name);
    checkNode(node.name, true);
  }

  function doubleFilter() {
    updateFilter();
    store.dispatch(Actions.addFilterLetter(node.name));
    expect(Selectors.getFilter(store.getState())).toEqual(
      node.name + node.name,
    );
    checkNode('', false);
  }

  function clearFilter() {
    updateFilter();
    store.dispatch(Actions.addFilterLetter('t'));
    checkNode('', false);
    store.dispatch(Actions.clearFilter());
    checkNode('', true);
  }

  it('should update when a letter is added', () => {
    updateFilter();
    store.dispatch(Actions.clearFilter());
  });

  it('should not match when filter does not equal name', () => {
    doubleFilter();
    store.dispatch(Actions.clearFilter());
  });

  it('should clear the filter, and return matching to normal', () => {
    node = getNode(dir1, dir1);
    clearFilter();
  });

  it('should remove filter letter', () => {
    updateFilter();
    store.dispatch(Actions.removeFilterLetter());
    checkNode(node.name.substr(0, node.name.length - 1), true);
    store.dispatch(Actions.clearFilter());
  });
});

it('omits hidden nodes', async () => {
  EpicHelpers.setRootKeys(store, [dir1]);
  store.dispatch(Actions.expandNode(dir1, fooTxt));
  store.dispatch(Actions.setIgnoredNames(['foo.*']));

  await loadChildKeys(dir1, dir1);

  expect(shownChildren(store.getState(), dir1, dir1).length).toBe(0);
});

it('shows nodes if the pattern changes to no longer match', async () => {
  EpicHelpers.setRootKeys(store, [dir1]);
  store.dispatch(Actions.expandNode(dir1, fooTxt));
  store.dispatch(Actions.setIgnoredNames(['foo.*']));

  await loadChildKeys(dir1, dir1);

  store.dispatch(Actions.setIgnoredNames(['bar.*']));

  expect(shownChildren(store.getState(), dir1, dir1).length).toBe(1);
});

it('obeys the hideIgnoredNames setting', async () => {
  EpicHelpers.setRootKeys(store, [dir1]);
  store.dispatch(Actions.expandNode(dir1, fooTxt));
  store.dispatch(Actions.setIgnoredNames(['foo.*']));
  store.dispatch(Actions.setHideIgnoredNames(false));

  await loadChildKeys(dir1, dir1);

  expect(shownChildren(store.getState(), dir1, dir1).length).toBe(1);
});

describe('recovering from failed subscriptions', () => {
  it('fetches children on re-expansion of failed directories', async () => {
    const unsubscribeableDir = new Directory(dir1);
    // Force subscription to fail to mimic network failure, etc.
    jest.spyOn(unsubscribeableDir, 'onDidChange').mockImplementation(() => {
      throw new Error('This error **should** be thrown.');
    });

    // Return the always-fail directory when it is expanded.
    jest
      .spyOn(FileTreeHelpers, 'getDirectoryByKey')
      .mockReturnValue(unsubscribeableDir);

    EpicHelpers.setRootKeys(store, [dir1]);
    store.dispatch(Actions.expandNode(dir1, dir1));
    await loadChildKeys(dir1, dir1);

    // Children should load but the subscription should fail.
    expect(shownChildren(store.getState(), dir1, dir1).map(n => n.uri)).toEqual(
      [fooTxt],
    );

    // Add a new file, 'bar.baz', for which the store will not get a notification because
    // the subscription failed.
    const barBaz = nuclideUri.join(dir1, 'bar.baz');
    fs.writeFileSync(barBaz, '');
    await loadChildKeys(dir1, dir1);
    expect(shownChildren(store.getState(), dir1, dir1).map(n => n.uri)).toEqual(
      [fooTxt],
    );

    // Collapsing and re-expanding a directory should forcibly fetch its children regardless of
    // whether a subscription is possible.
    store.dispatch(Actions.collapseNode(dir1, dir1));
    store.dispatch(Actions.expandNode(dir1, dir1));
    await loadChildKeys(dir1, dir1);

    // The subscription should fail again, but the children should be refetched and match the
    // changed structure (i.e. include the new 'bar.baz' file).
    expect(shownChildren(store.getState(), dir1, dir1).map(n => n.uri)).toEqual(
      [barBaz, fooTxt],
    );
    // $FlowFixMe
    FileTreeHelpers.getDirectoryByKey.mockRestore();
  });
});

it('omits vcs-excluded paths', async () => {
  EpicHelpers.setRootKeys(store, [dir1]);
  store.dispatch(Actions.expandNode(dir1, fooTxt));
  store.dispatch(Actions.setExcludeVcsIgnoredPaths(true));
  store.dispatch(Actions.setHideVcsIgnoredPaths(true));
  const mockRepo = new MockRepository(dir1);
  store.dispatch(Actions.setRepositories(Immutable.Set([(mockRepo: any)])));
  await loadChildKeys(dir1, dir1);
  expect(shownChildren(store.getState(), dir1, dir1).length).toBe(0);
});

it('includes vcs-excluded paths when told to', async () => {
  EpicHelpers.setRootKeys(store, [dir1]);
  store.dispatch(Actions.expandNode(dir1, fooTxt));
  store.dispatch(Actions.setExcludeVcsIgnoredPaths(false));
  store.dispatch(Actions.setHideVcsIgnoredPaths(false));

  const mockRepo = new MockRepository(dir1);
  store.dispatch(Actions.setRepositories(Immutable.Set([(mockRepo: any)])));

  await loadChildKeys(dir1, dir1);
  expect(shownChildren(store.getState(), dir1, dir1).length).toBe(1);
});

it('includes vcs-excluded paths when explicitly told to', async () => {
  EpicHelpers.setRootKeys(store, [dir1]);
  store.dispatch(Actions.expandNode(dir1, fooTxt));
  store.dispatch(Actions.setExcludeVcsIgnoredPaths(true));
  store.dispatch(Actions.setHideVcsIgnoredPaths(false));

  const mockRepo = new MockRepository(dir1);
  store.dispatch(Actions.setRepositories(Immutable.Set([(mockRepo: any)])));

  await loadChildKeys(dir1, dir1);
  expect(shownChildren(store.getState(), dir1, dir1).length).toBe(1);
});

it('expands deep nested structure of the node', async () => {
  await (async () => {
    const map: Map<string, string> = await buildTempDirTree(
      'dir3/dir31/foo31.txt',
      'dir3/dir32/bar32.txt',
    );
    const dir3 = map.get('dir3');
    const dir31 = map.get('dir3/dir31');
    // flowlint-next-line sketchy-null-string:off
    invariant(dir3 && dir31);
    EpicHelpers.setRootKeys(store, [dir3]);

    // Await **internal-only** API because the public `expandNodeDeep` API does not
    // return the promise that can be awaited on
    await EpicHelpers.expandNodeDeep(store, dir3, dir3);

    expect(shownChildren(store.getState(), dir3, dir31).length).toBe(1);
  })();
});

it('collapses deep nested structore', async () => {
  await (async () => {
    const map: Map<string, string> = await buildTempDirTree(
      'dir3/dir31/foo31.txt',
      'dir3/dir32/bar32.txt',
    );
    const dir3 = map.get('dir3');
    const dir31 = map.get('dir3/dir31');
    // flowlint-next-line sketchy-null-string:off
    invariant(dir3 && dir31);
    EpicHelpers.setRootKeys(store, [dir3]);

    // Await **internal-only** API because the public `expandNodeDeep` API does not
    // return the promise that can be awaited on
    await EpicHelpers.expandNodeDeep(store, dir3, dir3);
    expect(isExpanded(dir3, dir31)).toBe(true);
    store.dispatch(Actions.collapseNodeDeep(dir3, dir3));
    expect(isExpanded(dir3, dir31)).toBe(false);
  })();
});

it('stops expanding after adding 100 items to the tree in BFS order', async () => {
  await (async () => {
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
    EpicHelpers.setRootKeys(store, [dir3]);

    // Await **internal-only** API because the public `expandNodeDeep` API does not
    // return the promise that can be awaited on
    await EpicHelpers.expandNodeDeep(store, dir3, dir3);
    expect(isExpanded(dir3, dir31)).toBe(true);
    expect(isExpanded(dir3, dir32)).toBe(false);
  })();
});
it('should be able to add, remove, then re-add a file', async () => {
  const foo2Txt = nuclideUri.join(dir1, 'foo2.txt');

  EpicHelpers.setRootKeys(store, [dir1]);
  store.dispatch(Actions.expandNode(dir1, dir1));
  await loadChildKeys(dir1, dir1);
  fs.writeFileSync(foo2Txt, '');

  // Wait for the new file to be loaded.
  await waitsFor(() =>
    Boolean(Selectors.getNode(store.getState(), dir1, foo2Txt)),
  );

  // Ensure the child did not inherit the parent subscription.
  const child = getNode(dir1, foo2Txt);
  expect(child.subscription).toBe(null);
  fs.unlinkSync(foo2Txt);

  // Ensure that file disappears from the tree.
  await waitsFor(
    () => Selectors.getNode(store.getState(), dir1, foo2Txt) == null,
  );

  // Add the file back.
  fs.writeFileSync(foo2Txt, '');

  // Wait for the new file to be loaded.
  await waitsFor(() =>
    Boolean(Selectors.getNode(store.getState(), dir1, foo2Txt)),
  );
});

describe('selection', () => {
  beforeEach(() => {
    const fixturesPath = path.resolve(__dirname, '../__mocks__/fixtures');
    atom.project.setPaths([fixturesPath]);
    store.dispatch(Actions.updateRootDirectories());
  });

  describe('navigating with the keyboard', () => {
    const rootKey = nuclideUri.join(__dirname, '../__mocks__/fixtures') + '/';
    const dir0key =
      nuclideUri.join(__dirname, '../__mocks__/fixtures/dir0') + '/';
    const dir1Key =
      nuclideUri.join(__dirname, '../__mocks__/fixtures/dir1') + '/';
    const fooTxtKey = nuclideUri.join(
      __dirname,
      '../__mocks__/fixtures/dir1/foo.txt',
    );
    const dir2Key =
      nuclideUri.join(__dirname, '../__mocks__/fixtures/dir2') + '/';

    describe('with a collapsed root', () => {
      /*
       * Start with a simple structure that looks like the following:
       *
       *   → fixtures
       */
      describe('via Actions.collapseSelection (left arrow)', () => {
        it('does not modify the selection if the root is selected', () => {
          store.dispatch(Actions.setSelectedNode(rootKey, rootKey));
          expect(isSelected(rootKey, rootKey)).toEqual(true);
          store.dispatch(Actions.collapseSelection());

          // root was expanded, selection shouldn't change
          expect(isSelected(rootKey, rootKey)).toEqual(true);
        });
      });
    });

    describe('with single nesting', () => {
      beforeEach(async () => {
        /*
         * ༼ つ ◕_◕ ༽つ
         * Start with an expanded and fetched state that looks like the following:
         *
         *   ↓ fixtures
         *     → dir1
         *     → dir2
         */
        store.dispatch(Actions.expandNode(rootKey, rootKey));
        // Populate real files from real disk like real people.
        await EpicHelpers.fetchChildKeys(store, rootKey);
      });

      describe('via Actions.collapseSelection (left arrow) nested', () => {
        it('selects the parent if the selected node is a collapsed directory', () => {
          store.dispatch(Actions.setSelectedNode(rootKey, dir2Key));
          expect(isSelected(rootKey, dir2Key)).toEqual(true);
          store.dispatch(Actions.collapseSelection());

          // the root is dir2's parent
          expect(isSelected(rootKey, rootKey)).toEqual(true);
        });

        it('does not modify the selection if selected node is an expanded directory', () => {
          store.dispatch(Actions.setSelectedNode(rootKey, rootKey));
          expect(isSelected(rootKey, rootKey)).toEqual(true);
          store.dispatch(Actions.collapseSelection());

          // root was expanded, selection shouldn't change
          expect(isSelected(rootKey, rootKey)).toEqual(true);
        });
      });

      describe('via Actions.moveSelectionDown', () => {
        it('selects the first root if there is no selection', () => {
          expect(Selectors.getSingleSelectedNode(store.getState())).toBeNull();
          store.dispatch(Actions.moveSelectionDown());
          expect(isSelected(rootKey, rootKey)).toEqual(true);
        });

        it('does nothing if the bottommost node is selected', () => {
          store.dispatch(Actions.setSelectedNode(rootKey, dir2Key));
          expect(isSelected(rootKey, dir2Key)).toEqual(true);
          store.dispatch(Actions.moveSelectionDown());
          expect(isSelected(rootKey, dir2Key)).toEqual(true);
        });

        it('selects first child if parent is selected', () => {
          store.dispatch(Actions.setSelectedNode(rootKey, rootKey));
          expect(isSelected(rootKey, rootKey)).toEqual(true);
          store.dispatch(Actions.moveSelectionDown());

          // dir1 is the first child, should get selected
          expect(isSelected(rootKey, dir0key)).toEqual(true);
        });

        it('selects the next sibling when one exists', () => {
          store.dispatch(Actions.setSelectedNode(rootKey, dir1Key));
          expect(isSelected(rootKey, dir1Key)).toEqual(true);
          store.dispatch(Actions.moveSelectionDown());

          // dir2 is the next sibling, should get selected
          expect(isSelected(rootKey, dir2Key)).toEqual(true);
        });
      });

      describe('via Actions.modeSelectionUp', () => {
        it('selects the lowermost descendant if there is no selection', () => {
          expect(Selectors.getSingleSelectedNode(store.getState())).toBeNull();
          store.dispatch(Actions.moveSelectionUp());
          expect(isSelected(rootKey, dir2Key)).toEqual(true);
        });

        it('does nothing if the topmost root node is selected', () => {
          store.dispatch(Actions.setSelectedNode(rootKey, rootKey));
          expect(isSelected(rootKey, rootKey)).toEqual(true);
          store.dispatch(Actions.moveSelectionUp());
          expect(isSelected(rootKey, rootKey)).toEqual(true);
        });

        it('selects parent if first child is selected', () => {
          store.dispatch(Actions.setSelectedNode(rootKey, dir0key));
          expect(isSelected(rootKey, dir0key)).toEqual(true);
          store.dispatch(Actions.moveSelectionUp());

          // dir1 is the first child, parent (root) should get selected
          expect(isSelected(rootKey, rootKey)).toEqual(true);
        });

        it('selects the previous sibling if one exists', () => {
          store.dispatch(Actions.setSelectedNode(rootKey, dir2Key));
          expect(isSelected(rootKey, dir2Key)).toEqual(true);
          store.dispatch(Actions.moveSelectionUp());

          // dir2 is the second child, previous sibling (dir1) should be selected
          expect(isSelected(rootKey, dir1Key)).toEqual(true);
        });

        it('selects the root after deselecting via collapsing', () => {
          store.dispatch(Actions.setSelectedNode(rootKey, dir2Key));
          expect(isSelected(rootKey, dir2Key)).toEqual(true);
          store.dispatch(Actions.collapseNode(rootKey, rootKey));
          expect(isSelected(rootKey, dir2Key)).toEqual(false);
          store.dispatch(Actions.moveSelectionUp());

          expect(isSelected(rootKey, rootKey)).toEqual(true);
        });
      });
    });

    describe('with double+ nesting', () => {
      beforeEach(async () => {
        /*
           * ¯\_(ツ)_/���
           * Expand to a view like the following:
           *
           *   ↓ fixtures
           *     ↓ dir1
           *       · foo.txt
           *     → dir2
           */
        store.dispatch(Actions.expandNode(rootKey, rootKey));
        await EpicHelpers.fetchChildKeys(store, rootKey);
        store.dispatch(Actions.expandNode(rootKey, dir1Key));
        await EpicHelpers.fetchChildKeys(store, dir1Key);
      });

      describe('via Actions.collapseAll ( cmd+{ )', () => {
        it('collapses all visible nodes', () => {
          store.dispatch(Actions.collapseAll());
          expect(isExpanded(rootKey, rootKey)).toBe(false);
          expect(isExpanded(rootKey, dir1Key)).toBe(false);
        });
      });

      describe('via Actions.collapseSelection (left arrow) nested double+', () => {
        it('selects the parent if the selected node is a file', () => {
          store.dispatch(Actions.setSelectedNode(rootKey, fooTxtKey));
          expect(isSelected(rootKey, fooTxtKey)).toEqual(true);
          store.dispatch(Actions.collapseSelection());

          // dir1 is foo.txt's parent
          expect(isSelected(rootKey, dir1Key)).toEqual(true);
        });
      });

      describe('via Actions.moveSelectionDown nested double+', () => {
        it('selects the previous nested descendant when one exists', () => {
          store.dispatch(Actions.setSelectedNode(rootKey, fooTxtKey));
          expect(isSelected(rootKey, fooTxtKey)).toEqual(true);
          store.dispatch(Actions.moveSelectionDown());

          // foo.txt is the previous visible descendant to dir2
          expect(isSelected(rootKey, dir2Key)).toEqual(true);
        });
      });

      describe('via Actions.modeSelectionUp nested double+', () => {
        it('selects the previous nested descendant when one exists', () => {
          store.dispatch(Actions.setSelectedNode(rootKey, dir2Key));
          expect(isSelected(rootKey, dir2Key)).toEqual(true);
          store.dispatch(Actions.moveSelectionUp());

          // foo.txt is the previous visible descendant to dir2
          expect(isSelected(rootKey, fooTxtKey)).toEqual(true);
        });
      });

      describe('via Actions.moveSelectionToTop', () => {
        it('selects the root', () => {
          store.dispatch(Actions.setSelectedNode(rootKey, dir2Key));
          expect(isSelected(rootKey, dir2Key)).toEqual(true);
          store.dispatch(Actions.moveSelectionToTop());

          // the root is the topmost node
          expect(isSelected(rootKey, rootKey)).toEqual(true);
        });
      });

      describe('via Actions.moveSelectionToBottom', () => {
        it('selects the bottommost node', () => {
          store.dispatch(Actions.setSelectedNode(rootKey, rootKey));
          expect(isSelected(rootKey, rootKey)).toEqual(true);
          store.dispatch(Actions.moveSelectionToBottom());

          // dir2 is the bottommost node
          expect(isSelected(rootKey, dir2Key)).toEqual(true);
        });
      });
    });

    describe('with an expanded + loading directory', () => {
      beforeEach(async () => {
        /*
           * Expand to a view like the following with a loading (indicated by ↻) dir1:
           *
           *   ↓ fixtures
           *     ↻ dir1
           *     → dir2
           */
        store.dispatch(Actions.expandNode(rootKey, rootKey));
        await EpicHelpers.fetchChildKeys(store, rootKey);
        // Mimic the loading state where `dir1` reports itself as expanded but has no children
        // yet. Don't use `actions.expandNode` because it causes a re-render, which queues a real
        // fetch and might populate the children of `dir1`. We don't want that.
        store.dispatch(
          Actions.setRoots(
            FileTreeHelpers.updateNodeAtRoot(
              Selectors.getRoots(store.getState()),
              rootKey,
              dir1Key,
              node => node.set({isLoading: true, isExpanded: true}),
            ),
          ),
        );
      });

      describe('via Actions.moveSelectionDown expanded + loading', () => {
        it('selects the next sibling', () => {
          store.dispatch(Actions.setSelectedNode(rootKey, dir1Key));
          expect(isSelected(rootKey, dir1Key)).toEqual(true);
          store.dispatch(Actions.moveSelectionDown());
          // dir2 is dir1's next sibling
          expect(isSelected(rootKey, dir2Key)).toEqual(true);
        });
      });

      describe('via Actions.moveSelectionUp expanded + loading', () => {
        it('selects the previous sibling', () => {
          store.dispatch(Actions.setSelectedNode(rootKey, dir2Key));
          expect(isSelected(rootKey, dir2Key)).toEqual(true);
          store.dispatch(Actions.moveSelectionUp());

          // dir1 is dir2's previous sibling
          expect(isSelected(rootKey, dir1Key)).toEqual(true);
        });
      });
    });
  });

  describe('multi-selection and range-selection', () => {
    const rootKey = nuclideUri.join(__dirname, '../__mocks__/fixtures') + '/';
    const dir0 = nuclideUri.join(__dirname, '../__mocks__/fixtures/dir0') + '/';
    const bar =
      nuclideUri.join(__dirname, '../__mocks__/fixtures/dir0/bar') + '/';
    const bar1 = nuclideUri.join(
      __dirname,
      '../__mocks__/fixtures/dir0/bar/bar1',
    );
    const bar2 = nuclideUri.join(
      __dirname,
      '../__mocks__/fixtures/dir0/bar/bar2',
    );
    const bar3 = nuclideUri.join(
      __dirname,
      '../__mocks__/fixtures/dir0/bar/bar3',
    );
    const foo =
      nuclideUri.join(__dirname, '../__mocks__/fixtures/dir0/foo') + '/';
    const foo1 = nuclideUri.join(
      __dirname,
      '../__mocks__/fixtures/dir0/foo/foo1',
    );
    const foo2 = nuclideUri.join(
      __dirname,
      '../__mocks__/fixtures/dir0/foo/foo2',
    );
    const foo3 = nuclideUri.join(
      __dirname,
      '../__mocks__/fixtures/dir0/foo/foo3',
    );
    const afile = nuclideUri.join(
      __dirname,
      '../__mocks__/fixtures/dir0/afile',
    );
    const bfile = nuclideUri.join(
      __dirname,
      '../__mocks__/fixtures/dir0/bfile',
    );
    const zfile = nuclideUri.join(
      __dirname,
      '../__mocks__/fixtures/dir0/zfile',
    );

    beforeEach(async () => {
      // Await **internal-only** API because the public `expandNodeDeep` API does not
      // return the promise that can be awaited on
      await EpicHelpers.expandNodeDeep(store, rootKey, rootKey);
    });

    it('selects multiple items', () => {
      store.dispatch(Actions.addSelectedNode(rootKey, rootKey));
      store.dispatch(Actions.addSelectedNode(rootKey, dir0));
      store.dispatch(Actions.addSelectedNode(rootKey, bar1));
      expect(isSelected(rootKey, rootKey)).toBe(true);
      expect(isSelected(rootKey, dir0)).toBe(true);
      expect(isSelected(rootKey, bar1)).toBe(true);
      expect(numSelected()).toBe(3);
      store.dispatch(Actions.setSelectedNode(rootKey, bar));
      expect(isSelected(rootKey, bar)).toBe(true);
      expect(numSelected()).toBe(1);
    });

    it('selects a range of items', () => {
      store.dispatch(Actions.setSelectedNode(rootKey, foo1));
      store.dispatch(Actions.rangeSelectToNode(rootKey, bar2));
      expect(isSelected(rootKey, bar2)).toBe(true);
      expect(isSelected(rootKey, bar3)).toBe(true);
      expect(isSelected(rootKey, foo)).toBe(true);
      expect(isSelected(rootKey, foo1)).toBe(true);
      expect(numSelected()).toBe(4);
    });

    it('selects multiple range of items', () => {
      store.dispatch(Actions.setSelectedNode(rootKey, foo1));
      store.dispatch(Actions.rangeSelectToNode(rootKey, bar2));
      store.dispatch(Actions.addSelectedNode(rootKey, foo3));
      store.dispatch(Actions.rangeSelectToNode(rootKey, afile));
      expect(isSelected(rootKey, bar2)).toBe(true);
      expect(isSelected(rootKey, bar3)).toBe(true);
      expect(isSelected(rootKey, foo)).toBe(true);
      expect(isSelected(rootKey, foo1)).toBe(true);
      expect(isSelected(rootKey, foo3)).toBe(true);
      expect(isSelected(rootKey, afile)).toBe(true);
      expect(numSelected()).toBe(6);
    });

    it('selects range in opposite directions', () => {
      store.dispatch(Actions.setSelectedNode(rootKey, foo1));
      store.dispatch(Actions.rangeSelectToNode(rootKey, bar2));
      expect(isSelected(rootKey, bar2)).toBe(true);
      expect(isSelected(rootKey, bar3)).toBe(true);
      expect(isSelected(rootKey, foo)).toBe(true);
      expect(isSelected(rootKey, foo1)).toBe(true);
      expect(numSelected()).toBe(4);
      store.dispatch(Actions.rangeSelectToNode(rootKey, afile));
      expect(isSelected(rootKey, foo1)).toBe(true);
      expect(isSelected(rootKey, foo2)).toBe(true);
      expect(isSelected(rootKey, foo3)).toBe(true);
      expect(isSelected(rootKey, afile)).toBe(true);
      expect(numSelected()).toBe(4);
    });

    it('handles overlap ranges', () => {
      store.dispatch(Actions.setSelectedNode(rootKey, foo1));
      store.dispatch(Actions.rangeSelectToNode(rootKey, bar2));
      store.dispatch(Actions.addSelectedNode(rootKey, bar1));
      store.dispatch(Actions.rangeSelectToNode(rootKey, afile));
      expect(isSelected(rootKey, bar1)).toBe(true);
      expect(isSelected(rootKey, bar2)).toBe(true);
      expect(isSelected(rootKey, bar3)).toBe(true);
      expect(isSelected(rootKey, foo)).toBe(true);
      expect(isSelected(rootKey, foo1)).toBe(true);
      expect(isSelected(rootKey, foo2)).toBe(true);
      expect(isSelected(rootKey, foo3)).toBe(true);
      expect(isSelected(rootKey, afile)).toBe(true);
      expect(numSelected()).toBe(8);
    });

    it('support shift up and shift down', () => {
      store.dispatch(Actions.setSelectedNode(rootKey, foo1));
      store.dispatch(Actions.rangeSelectUp());
      expect(isSelected(rootKey, foo)).toBe(true);
      expect(isSelected(rootKey, foo1)).toBe(true);
      expect(numSelected()).toBe(2);
      store.dispatch(Actions.rangeSelectDown());
      expect(isSelected(rootKey, foo1)).toBe(true);
      expect(numSelected()).toBe(1);
      store.dispatch(Actions.rangeSelectDown());
      expect(isSelected(rootKey, foo1)).toBe(true);
      expect(isSelected(rootKey, foo2)).toBe(true);
      expect(numSelected()).toBe(2);
      store.dispatch(Actions.rangeSelectDown());
      expect(isSelected(rootKey, foo1)).toBe(true);
      expect(isSelected(rootKey, foo2)).toBe(true);
      expect(isSelected(rootKey, foo3)).toBe(true);
      expect(numSelected()).toBe(3);
    });

    it('merges range for shift up and down', () => {
      store.dispatch(Actions.setSelectedNode(rootKey, bar2));
      store.dispatch(Actions.rangeSelectToNode(rootKey, bar3));
      store.dispatch(Actions.addSelectedNode(rootKey, foo1));
      store.dispatch(Actions.rangeSelectUp());
      store.dispatch(Actions.rangeSelectUp());
      expect(isSelected(rootKey, bar1)).toBe(true);
      expect(isSelected(rootKey, bar2)).toBe(true);
      expect(isSelected(rootKey, bar3)).toBe(true);
      expect(isSelected(rootKey, foo)).toBe(true);
      expect(isSelected(rootKey, foo1)).toBe(true);
      expect(numSelected()).toBe(5);
    });

    it('handles unselected anchor', () => {
      store.dispatch(Actions.setSelectedNode(rootKey, foo1));
      store.dispatch(Actions.rangeSelectToNode(rootKey, bar2));
      store.dispatch(Actions.unselectNode(rootKey, foo1));
      store.dispatch(Actions.rangeSelectToNode(rootKey, bar1));
      expect(isSelected(rootKey, bar1)).toBe(true);
      expect(isSelected(rootKey, bar2)).toBe(true);
      expect(isSelected(rootKey, bar3)).toBe(true);
      expect(isSelected(rootKey, foo)).toBe(true);
      expect(numSelected()).toBe(4);
    });

    it('handles unselected range', () => {
      store.dispatch(Actions.setSelectedNode(rootKey, foo1));
      store.dispatch(Actions.rangeSelectToNode(rootKey, bar2));
      store.dispatch(Actions.unselectNode(rootKey, bar2));
      store.dispatch(Actions.rangeSelectToNode(rootKey, bar1));
      expect(isSelected(rootKey, bar1)).toBe(true);
      expect(isSelected(rootKey, bar2)).toBe(true);
      expect(isSelected(rootKey, bar3)).toBe(true);
      expect(isSelected(rootKey, foo)).toBe(true);
      expect(isSelected(rootKey, foo1)).toBe(true);
      expect(numSelected()).toBe(5);
      store.dispatch(Actions.rangeSelectDown());
      expect(isSelected(rootKey, bar1)).toBe(false);
      expect(numSelected()).toBe(4);
    });

    it('handles unselected node within the range', () => {
      store.dispatch(Actions.setSelectedNode(rootKey, foo1));
      store.dispatch(Actions.rangeSelectToNode(rootKey, bar2));
      store.dispatch(Actions.unselectNode(rootKey, bar3));
      store.dispatch(Actions.rangeSelectToNode(rootKey, bar1));
      expect(isSelected(rootKey, bar1)).toBe(true);
      expect(isSelected(rootKey, bar2)).toBe(true);
      expect(isSelected(rootKey, bar3)).toBe(false);
      expect(isSelected(rootKey, foo)).toBe(true);
      expect(isSelected(rootKey, foo1)).toBe(true);
      expect(numSelected()).toBe(4);
      store.dispatch(Actions.rangeSelectToNode(rootKey, foo2));
      expect(isSelected(rootKey, foo1)).toBe(true);
      expect(isSelected(rootKey, foo2)).toBe(true);
      expect(numSelected()).toBe(2);
    });

    it('does nothing when all nodes are unselected', () => {
      store.dispatch(Actions.setSelectedNode(rootKey, foo1));
      store.dispatch(Actions.rangeSelectToNode(rootKey, bar2));
      store.dispatch(Actions.unselectNode(rootKey, bar2));
      store.dispatch(Actions.unselectNode(rootKey, bar3));
      store.dispatch(Actions.unselectNode(rootKey, foo));
      store.dispatch(Actions.unselectNode(rootKey, foo1));
      store.dispatch(Actions.rangeSelectToNode(rootKey, bar1));
      expect(numSelected()).toBe(0);
    });

    it('can handle part of the selected range been collaped', () => {
      store.dispatch(Actions.setSelectedNode(rootKey, foo1));
      store.dispatch(Actions.rangeSelectToNode(rootKey, bar2));
      store.dispatch(Actions.collapseNode(rootKey, foo));
      expect(isSelected(rootKey, bar2)).toBe(true);
      expect(isSelected(rootKey, bar3)).toBe(true);
      expect(isSelected(rootKey, foo)).toBe(true);
      expect(numSelected()).toBe(3);
      store.dispatch(Actions.rangeSelectToNode(rootKey, bfile));
      expect(isSelected(rootKey, foo)).toBe(true);
      expect(isSelected(rootKey, afile)).toBe(true);
      expect(isSelected(rootKey, bfile)).toBe(true);
      expect(numSelected()).toBe(3);
    });

    it('supports workingset', () => {
      store.dispatch(
        Actions.updateWorkingSet(new WorkingSet([bar2, foo, zfile])),
      );
      store.dispatch(Actions.setSelectedNode(rootKey, foo3));
      store.dispatch(Actions.rangeSelectToNode(rootKey, zfile));
      expect(isSelected(rootKey, foo3)).toBe(true);
      expect(isSelected(rootKey, zfile)).toBe(true);
      expect(numSelected()).toBe(2);
      store.dispatch(Actions.rangeSelectUp());
      expect(isSelected(rootKey, foo3)).toBe(true);
      expect(numSelected()).toBe(1);
    });
  });

  describe('RangeUtil', () => {
    async function prepareFileTree(): Promise<Map<string, string>> {
      const map: Map<string, string> = await buildTempDirTree(
        'dir/foo/foo1',
        'dir/foo/foo2',
        'dir/bar/bar1',
        'dir/bar/bar2',
        'dir/bar/bar3',
      );
      const dir = map.get('dir');
      // flowlint-next-line sketchy-null-string:off
      invariant(dir);
      EpicHelpers.setRootKeys(store, [dir]);
      return map;
    }

    let map: Map<string, string> = new Map();

    beforeEach(async () => {
      map = await prepareFileTree();
      const dir = map.get('dir');
      // flowlint-next-line sketchy-null-string:off
      invariant(dir);
      // Await **internal-only** API because the public `expandNodeDeep` API does not
      // return the promise that can be awaited on
      await EpicHelpers.expandNodeDeep(store, dir, dir);
    });

    afterEach(async () => {
      await tempCleanup();
    });

    describe('findSelectedNode', () => {
      it('returns the node itself if it is shown and selected', () => {
        const dir = map.get('dir');
        const bar1 = map.get('dir/bar/bar1');
        // flowlint-next-line sketchy-null-string:off
        invariant(dir);
        // flowlint-next-line sketchy-null-string:off
        invariant(bar1);
        store.dispatch(Actions.setSelectedNode(dir, bar1));
        const node = Selectors.getNode(store.getState(), dir, bar1);
        invariant(node);
        expect(Selectors.getNearbySelectedNode(store.getState(), node)).toBe(
          node,
        );
      });

      it('searches the next selected node if passed in node is unselected', () => {
        const dir = map.get('dir');
        const bar1 = map.get('dir/bar/bar1');
        const bar3 = map.get('dir/bar/bar3');
        // flowlint-next-line sketchy-null-string:off
        invariant(dir);
        // flowlint-next-line sketchy-null-string:off
        invariant(bar1);
        // flowlint-next-line sketchy-null-string:off
        invariant(bar3);
        store.dispatch(Actions.setSelectedNode(dir, bar3));
        const node = Selectors.getNode(store.getState(), dir, bar1);
        invariant(node);
        expect(Selectors.getNearbySelectedNode(store.getState(), node)).toBe(
          Selectors.getNode(store.getState(), dir, bar3),
        );
      });

      it('searches the prev selected node if nothing else is selected', () => {
        const dir = map.get('dir');
        const bar1 = map.get('dir/bar/bar1');
        const bar3 = map.get('dir/bar/bar3');
        // flowlint-next-line sketchy-null-string:off
        invariant(dir);
        // flowlint-next-line sketchy-null-string:off
        invariant(bar1);
        // flowlint-next-line sketchy-null-string:off
        invariant(bar3);
        store.dispatch(Actions.setSelectedNode(dir, bar1));
        const node = Selectors.getNode(store.getState(), dir, bar3);
        invariant(node);
        expect(Selectors.getNearbySelectedNode(store.getState(), node)).toBe(
          Selectors.getNode(store.getState(), dir, bar1),
        );
      });

      it('returns null if nothing is selected', () => {
        const dir = map.get('dir');
        const bar1 = map.get('dir/bar/bar1');
        // flowlint-next-line sketchy-null-string:off
        invariant(dir);
        // flowlint-next-line sketchy-null-string:off
        invariant(bar1);
        const node = Selectors.getNode(store.getState(), dir, bar1);
        invariant(node);
        expect(Selectors.getNearbySelectedNode(store.getState(), node)).toBe(
          null,
        );
      });

      it('searches the next selected node if itself is not shown', () => {
        const dir = map.get('dir');
        const foo = map.get('dir/foo');
        const foo1 = map.get('dir/foo/foo1');
        const bar1 = map.get('dir/bar/bar1');
        // flowlint-next-line sketchy-null-string:off
        invariant(dir);
        // flowlint-next-line sketchy-null-string:off
        invariant(foo);
        // flowlint-next-line sketchy-null-string:off
        invariant(foo1);
        // flowlint-next-line sketchy-null-string:off
        invariant(bar1);
        store.dispatch(Actions.collapseNode(dir, foo));
        store.dispatch(Actions.setSelectedNode(dir, bar1));
        const node = Selectors.getNode(store.getState(), dir, foo1);
        invariant(node);
        expect(Selectors.getNearbySelectedNode(store.getState(), node)).toBe(
          Selectors.getNode(store.getState(), dir, bar1),
        );
      });

      it('only searches the selected node within the working set', () => {
        const dir = map.get('dir');
        const foo1 = map.get('dir/foo/foo1');
        const bar1 = map.get('dir/bar/bar1');
        // flowlint-next-line sketchy-null-string:off
        invariant(dir);
        // flowlint-next-line sketchy-null-string:off
        invariant(foo1);
        // flowlint-next-line sketchy-null-string:off
        invariant(bar1);
        store.dispatch(Actions.updateWorkingSet(new WorkingSet([foo1, bar1])));
        store.dispatch(Actions.setSelectedNode(dir, bar1));
        const node = Selectors.getNode(store.getState(), dir, foo1);
        invariant(node);
        expect(Selectors.getNearbySelectedNode(store.getState(), node)).toBe(
          Selectors.getNode(store.getState(), dir, bar1),
        );
      });
    });
  });
});
