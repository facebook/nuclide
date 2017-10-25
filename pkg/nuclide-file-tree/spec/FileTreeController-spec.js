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

import FileTreeActions from '../lib/FileTreeActions';
import FileTreeController from '../lib/FileTreeController';
import {FileTreeStore} from '../lib/FileTreeStore';
import type {FileTreeNode} from '../lib/FileTreeNode';
import {WorkingSet} from '../../nuclide-working-sets-common';

import nuclideUri from 'nuclide-commons/nuclideUri';
import invariant from 'assert';

describe('FileTreeController', () => {
  const actions = FileTreeActions.getInstance();
  const store = FileTreeStore.getInstance();

  let controller: FileTreeController = (null: any);
  let workspaceElement;

  function getNode(rootKey: string, nodeKey: string): FileTreeNode {
    const node = store.getNode(rootKey, nodeKey);
    invariant(node);
    return node;
  }

  function isSelected(rootKey: string, nodeKey: string): boolean {
    return getNode(rootKey, nodeKey).isSelected();
  }

  function isExpanded(rootKey: string, nodeKey: string): boolean {
    return getNode(rootKey, nodeKey).isExpanded;
  }

  function numSelected(): number {
    return store.getSelectedNodes().size;
  }

  beforeEach(() => {
    workspaceElement = atom.views.getView(atom.workspace);
    // Attach the workspace to the DOM so focus can be determined in tests below.
    jasmine.attachToDOM(workspaceElement);
    controller = new FileTreeController(null);

    // The controller uses the currently active file to decide when and what to reveal in the file
    // tree when revealActiveFile is called. Importantly, it also short-circuits in some cases if
    // the path is null or undefined. Here we mock it out so that we get normal behavior in our
    // tests.
    spyOn(atom.workspace, 'getActiveTextEditor').andReturn({
      getPath() {
        return 'foo';
      },
    });
  });

  afterEach(() => {
    controller.destroy();
    actions.updateWorkingSet(new WorkingSet([]));
    store.reset();
  });

  describe('navigating with the keyboard', () => {
    const rootKey = nuclideUri.join(__dirname, 'fixtures') + '/';
    const dir0key = nuclideUri.join(__dirname, 'fixtures/dir0') + '/';
    const dir1Key = nuclideUri.join(__dirname, 'fixtures/dir1') + '/';
    const fooTxtKey = nuclideUri.join(__dirname, 'fixtures/dir1/foo.txt');
    const dir2Key = nuclideUri.join(__dirname, 'fixtures/dir2') + '/';

    describe('with a collapsed root', () => {
      /*
       * Start with a simple structure that looks like the following:
       *
       *   → fixtures
       */
      describe('via _collapseSelection (left arrow)', () => {
        it('does not modify the selection if the root is selected', () => {
          actions.setSelectedNode(rootKey, rootKey);
          expect(isSelected(rootKey, rootKey)).toEqual(true);
          controller._collapseSelection();

          // root was expanded, selection shouldn't change
          expect(isSelected(rootKey, rootKey)).toEqual(true);
        });
      });
    });

    describe('with single nesting', () => {
      beforeEach(() => {
        /*
         * ༼ つ ◕_◕ ༽つ
         * Start with an expanded and fetched state that looks like the following:
         *
         *   ↓ fixtures
         *     → dir1
         *     → dir2
         */
        waitsForPromise(async () => {
          actions.expandNode(rootKey, rootKey);
          // Populate real files from real disk like real people.
          await store._fetchChildKeys(rootKey);
        });
      });

      describe('via _collapseSelection (left arrow) nested', () => {
        it('selects the parent if the selected node is a collapsed directory', () => {
          actions.setSelectedNode(rootKey, dir2Key);
          expect(isSelected(rootKey, dir2Key)).toEqual(true);
          controller._collapseSelection();

          // the root is dir2's parent
          expect(isSelected(rootKey, rootKey)).toEqual(true);
        });

        it('does not modify the selection if selected node is an expanded directory', () => {
          actions.setSelectedNode(rootKey, rootKey);
          expect(isSelected(rootKey, rootKey)).toEqual(true);
          controller._collapseSelection();

          // root was expanded, selection shouldn't change
          expect(isSelected(rootKey, rootKey)).toEqual(true);
        });
      });

      describe('via _moveDown', () => {
        it('selects the first root if there is no selection', () => {
          expect(store.getSingleSelectedNode()).toBeNull();
          controller._moveDown();
          expect(isSelected(rootKey, rootKey)).toEqual(true);
        });

        it('does nothing if the bottommost node is selected', () => {
          actions.setSelectedNode(rootKey, dir2Key);
          expect(isSelected(rootKey, dir2Key)).toEqual(true);
          controller._moveDown();
          expect(isSelected(rootKey, dir2Key)).toEqual(true);
        });

        it('selects first child if parent is selected', () => {
          actions.setSelectedNode(rootKey, rootKey);
          expect(isSelected(rootKey, rootKey)).toEqual(true);
          controller._moveDown();

          // dir1 is the first child, should get selected
          expect(isSelected(rootKey, dir0key)).toEqual(true);
        });

        it('selects the next sibling when one exists', () => {
          actions.setSelectedNode(rootKey, dir1Key);
          expect(isSelected(rootKey, dir1Key)).toEqual(true);
          controller._moveDown();

          // dir2 is the next sibling, should get selected
          expect(isSelected(rootKey, dir2Key)).toEqual(true);
        });
      });

      describe('via _moveUp', () => {
        it('selects the lowermost descendant if there is no selection', () => {
          expect(store.getSingleSelectedNode()).toBeNull();
          controller._moveUp();
          expect(isSelected(rootKey, dir2Key)).toEqual(true);
        });

        it('does nothing if the topmost root node is selected', () => {
          actions.setSelectedNode(rootKey, rootKey);
          expect(isSelected(rootKey, rootKey)).toEqual(true);
          controller._moveUp();
          expect(isSelected(rootKey, rootKey)).toEqual(true);
        });

        it('selects parent if first child is selected', () => {
          actions.setSelectedNode(rootKey, dir0key);
          expect(isSelected(rootKey, dir0key)).toEqual(true);
          controller._moveUp();

          // dir1 is the first child, parent (root) should get selected
          expect(isSelected(rootKey, rootKey)).toEqual(true);
        });

        it('selects the previous sibling if one exists', () => {
          actions.setSelectedNode(rootKey, dir2Key);
          expect(isSelected(rootKey, dir2Key)).toEqual(true);
          controller._moveUp();

          // dir2 is the second child, previous sibling (dir1) should be selected
          expect(isSelected(rootKey, dir1Key)).toEqual(true);
        });

        it('selects the root after deselecting via collapsing', () => {
          actions.setSelectedNode(rootKey, dir2Key);
          expect(isSelected(rootKey, dir2Key)).toEqual(true);
          actions.collapseNode(rootKey, rootKey);
          expect(isSelected(rootKey, dir2Key)).toEqual(false);
          controller._moveUp();

          expect(isSelected(rootKey, rootKey)).toEqual(true);
        });
      });
    });

    describe('with double+ nesting', () => {
      beforeEach(() => {
        waitsForPromise(async () => {
          /*
           * ¯\_(ツ)_/¯
           * Expand to a view like the following:
           *
           *   ↓ fixtures
           *     ↓ dir1
           *       · foo.txt
           *     → dir2
           */
          actions.expandNode(rootKey, rootKey);
          await store._fetchChildKeys(rootKey);
          actions.expandNode(rootKey, dir1Key);
          await store._fetchChildKeys(dir1Key);
        });
      });

      describe('via _collapseAll ( cmd+{ )', () => {
        it('collapses all visible nodes', () => {
          controller._collapseAll();
          expect(isExpanded(rootKey, rootKey)).toBe(false);
          expect(isExpanded(rootKey, dir1Key)).toBe(false);
        });
      });

      describe('via _collapseSelection (left arrow) nested double+', () => {
        it('selects the parent if the selected node is a file', () => {
          actions.setSelectedNode(rootKey, fooTxtKey);
          expect(isSelected(rootKey, fooTxtKey)).toEqual(true);
          controller._collapseSelection();

          // dir1 is foo.txt's parent
          expect(isSelected(rootKey, dir1Key)).toEqual(true);
        });
      });

      describe('via _moveDown nested double+', () => {
        it('selects the previous nested descendant when one exists', () => {
          actions.setSelectedNode(rootKey, fooTxtKey);
          expect(isSelected(rootKey, fooTxtKey)).toEqual(true);
          controller._moveDown();

          // foo.txt is the previous visible descendant to dir2
          expect(isSelected(rootKey, dir2Key)).toEqual(true);
        });
      });

      describe('via _moveUp nested double+', () => {
        it('selects the previous nested descendant when one exists', () => {
          actions.setSelectedNode(rootKey, dir2Key);
          expect(isSelected(rootKey, dir2Key)).toEqual(true);
          controller._moveUp();

          // foo.txt is the previous visible descendant to dir2
          expect(isSelected(rootKey, fooTxtKey)).toEqual(true);
        });
      });

      describe('via _moveToTop', () => {
        it('selects the root', () => {
          actions.setSelectedNode(rootKey, dir2Key);
          expect(isSelected(rootKey, dir2Key)).toEqual(true);
          controller._moveToTop();

          // the root is the topmost node
          expect(isSelected(rootKey, rootKey)).toEqual(true);
        });
      });

      describe('via _moveToBottom', () => {
        it('selects the bottommost node', () => {
          actions.setSelectedNode(rootKey, rootKey);
          expect(isSelected(rootKey, rootKey)).toEqual(true);
          controller._moveToBottom();

          // dir2 is the bottommost node
          expect(isSelected(rootKey, dir2Key)).toEqual(true);
        });
      });
    });

    describe('with an expanded + loading directory', () => {
      beforeEach(() => {
        waitsForPromise(async () => {
          /*
           * Expand to a view like the following with a loading (indicated by ↻) dir1:
           *
           *   ↓ fixtures
           *     ↻ dir1
           *     → dir2
           */
          actions.expandNode(rootKey, rootKey);
          await store._fetchChildKeys(rootKey);
          // Mimic the loading state where `dir1` reports itself as expanded but has no children
          // yet. Don't use `actions.expandNode` because it causes a re-render, which queues a real
          // fetch and might populate the children of `dir1`. We don't want that.
          store._updateNodeAtRoot(rootKey, dir1Key, node =>
            node.set({isLoading: true, isExpanded: true}),
          );
        });
      });

      describe('via _moveDown expanded + loading', () => {
        it('selects the next sibling', () => {
          actions.setSelectedNode(rootKey, dir1Key);
          expect(isSelected(rootKey, dir1Key)).toEqual(true);
          controller._moveDown();
          // dir2 is dir1's next sibling
          expect(isSelected(rootKey, dir2Key)).toEqual(true);
        });
      });

      describe('via _moveUp expanded + loading', () => {
        it('selects the previous sibling', () => {
          actions.setSelectedNode(rootKey, dir2Key);
          expect(isSelected(rootKey, dir2Key)).toEqual(true);
          controller._moveUp();

          // dir1 is dir2's previous sibling
          expect(isSelected(rootKey, dir1Key)).toEqual(true);
        });
      });
    });
  });

  describe('multi-selection and range-selection', () => {
    const rootKey = nuclideUri.join(__dirname, 'fixtures') + '/';
    const dir0 = nuclideUri.join(__dirname, 'fixtures/dir0') + '/';
    const bar = nuclideUri.join(__dirname, 'fixtures/dir0/bar') + '/';
    const bar1 = nuclideUri.join(__dirname, 'fixtures/dir0/bar/bar1');
    const bar2 = nuclideUri.join(__dirname, 'fixtures/dir0/bar/bar2');
    const bar3 = nuclideUri.join(__dirname, 'fixtures/dir0/bar/bar3');
    const foo = nuclideUri.join(__dirname, 'fixtures/dir0/foo') + '/';
    const foo1 = nuclideUri.join(__dirname, 'fixtures/dir0/foo/foo1');
    const foo2 = nuclideUri.join(__dirname, 'fixtures/dir0/foo/foo2');
    const foo3 = nuclideUri.join(__dirname, 'fixtures/dir0/foo/foo3');
    const afile = nuclideUri.join(__dirname, 'fixtures/dir0/afile');
    const bfile = nuclideUri.join(__dirname, 'fixtures/dir0/bfile');
    const zfile = nuclideUri.join(__dirname, 'fixtures/dir0/zfile');

    beforeEach(() => {
      waitsForPromise(async () => {
        // Await **internal-only** API because the public `expandNodeDeep` API does not
        // return the promise that can be awaited on
        await store._expandNodeDeep(rootKey, rootKey);
      });
    });

    it('selects multiple items', () => {
      actions.addSelectedNode(rootKey, rootKey);
      actions.addSelectedNode(rootKey, dir0);
      actions.addSelectedNode(rootKey, bar1);
      expect(isSelected(rootKey, rootKey)).toBe(true);
      expect(isSelected(rootKey, dir0)).toBe(true);
      expect(isSelected(rootKey, bar1)).toBe(true);
      expect(numSelected()).toBe(3);
      actions.setSelectedNode(rootKey, bar);
      expect(isSelected(rootKey, bar)).toBe(true);
      expect(numSelected()).toBe(1);
    });

    it('selects a range of items', () => {
      actions.setSelectedNode(rootKey, foo1);
      actions.rangeSelectToNode(rootKey, bar2);
      expect(isSelected(rootKey, bar2)).toBe(true);
      expect(isSelected(rootKey, bar3)).toBe(true);
      expect(isSelected(rootKey, foo)).toBe(true);
      expect(isSelected(rootKey, foo1)).toBe(true);
      expect(numSelected()).toBe(4);
    });

    it('selects multiple range of items', () => {
      actions.setSelectedNode(rootKey, foo1);
      actions.rangeSelectToNode(rootKey, bar2);
      actions.addSelectedNode(rootKey, foo3);
      actions.rangeSelectToNode(rootKey, afile);
      expect(isSelected(rootKey, bar2)).toBe(true);
      expect(isSelected(rootKey, bar3)).toBe(true);
      expect(isSelected(rootKey, foo)).toBe(true);
      expect(isSelected(rootKey, foo1)).toBe(true);
      expect(isSelected(rootKey, foo3)).toBe(true);
      expect(isSelected(rootKey, afile)).toBe(true);
      expect(numSelected()).toBe(6);
    });

    it('selects range in opposite directions', () => {
      actions.setSelectedNode(rootKey, foo1);
      actions.rangeSelectToNode(rootKey, bar2);
      expect(isSelected(rootKey, bar2)).toBe(true);
      expect(isSelected(rootKey, bar3)).toBe(true);
      expect(isSelected(rootKey, foo)).toBe(true);
      expect(isSelected(rootKey, foo1)).toBe(true);
      expect(numSelected()).toBe(4);
      actions.rangeSelectToNode(rootKey, afile);
      expect(isSelected(rootKey, foo1)).toBe(true);
      expect(isSelected(rootKey, foo2)).toBe(true);
      expect(isSelected(rootKey, foo3)).toBe(true);
      expect(isSelected(rootKey, afile)).toBe(true);
      expect(numSelected()).toBe(4);
    });

    it('handles overlap ranges', () => {
      actions.setSelectedNode(rootKey, foo1);
      actions.rangeSelectToNode(rootKey, bar2);
      actions.addSelectedNode(rootKey, bar1);
      actions.rangeSelectToNode(rootKey, afile);
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
      actions.setSelectedNode(rootKey, foo1);
      controller._rangeSelectUp();
      expect(isSelected(rootKey, foo)).toBe(true);
      expect(isSelected(rootKey, foo1)).toBe(true);
      expect(numSelected()).toBe(2);
      controller._rangeSelectDown();
      expect(isSelected(rootKey, foo1)).toBe(true);
      expect(numSelected()).toBe(1);
      controller._rangeSelectDown();
      expect(isSelected(rootKey, foo1)).toBe(true);
      expect(isSelected(rootKey, foo2)).toBe(true);
      expect(numSelected()).toBe(2);
      controller._rangeSelectDown();
      expect(isSelected(rootKey, foo1)).toBe(true);
      expect(isSelected(rootKey, foo2)).toBe(true);
      expect(isSelected(rootKey, foo3)).toBe(true);
      expect(numSelected()).toBe(3);
    });

    it('merges range for shift up and down', () => {
      actions.setSelectedNode(rootKey, bar2);
      actions.rangeSelectToNode(rootKey, bar3);
      actions.addSelectedNode(rootKey, foo1);
      controller._rangeSelectUp();
      controller._rangeSelectUp();
      expect(isSelected(rootKey, bar1)).toBe(true);
      expect(isSelected(rootKey, bar2)).toBe(true);
      expect(isSelected(rootKey, bar3)).toBe(true);
      expect(isSelected(rootKey, foo)).toBe(true);
      expect(isSelected(rootKey, foo1)).toBe(true);
      expect(numSelected()).toBe(5);
    });

    it('handles unselected anchor', () => {
      actions.setSelectedNode(rootKey, foo1);
      actions.rangeSelectToNode(rootKey, bar2);
      actions.unselectNode(rootKey, foo1);
      actions.rangeSelectToNode(rootKey, bar1);
      expect(isSelected(rootKey, bar1)).toBe(true);
      expect(isSelected(rootKey, bar2)).toBe(true);
      expect(isSelected(rootKey, bar3)).toBe(true);
      expect(isSelected(rootKey, foo)).toBe(true);
      expect(numSelected()).toBe(4);
    });

    it('handles unselected range', () => {
      actions.setSelectedNode(rootKey, foo1);
      actions.rangeSelectToNode(rootKey, bar2);
      actions.unselectNode(rootKey, bar2);
      actions.rangeSelectToNode(rootKey, bar1);
      expect(isSelected(rootKey, bar1)).toBe(true);
      expect(isSelected(rootKey, bar2)).toBe(true);
      expect(isSelected(rootKey, bar3)).toBe(true);
      expect(isSelected(rootKey, foo)).toBe(true);
      expect(isSelected(rootKey, foo1)).toBe(true);
      expect(numSelected()).toBe(5);
      actions.rangeSelectDown();
      expect(isSelected(rootKey, bar1)).toBe(false);
      expect(numSelected()).toBe(4);
    });

    it('handles unselected node within the range', () => {
      actions.setSelectedNode(rootKey, foo1);
      actions.rangeSelectToNode(rootKey, bar2);
      actions.unselectNode(rootKey, bar3);
      actions.rangeSelectToNode(rootKey, bar1);
      expect(isSelected(rootKey, bar1)).toBe(true);
      expect(isSelected(rootKey, bar2)).toBe(true);
      expect(isSelected(rootKey, bar3)).toBe(false);
      expect(isSelected(rootKey, foo)).toBe(true);
      expect(isSelected(rootKey, foo1)).toBe(true);
      expect(numSelected()).toBe(4);
      actions.rangeSelectToNode(rootKey, foo2);
      expect(isSelected(rootKey, foo1)).toBe(true);
      expect(isSelected(rootKey, foo2)).toBe(true);
      expect(numSelected()).toBe(2);
    });

    it('does nothing when all nodes are unselected', () => {
      actions.setSelectedNode(rootKey, foo1);
      actions.rangeSelectToNode(rootKey, bar2);
      actions.unselectNode(rootKey, bar2);
      actions.unselectNode(rootKey, bar3);
      actions.unselectNode(rootKey, foo);
      actions.unselectNode(rootKey, foo1);
      actions.rangeSelectToNode(rootKey, bar1);
      expect(numSelected()).toBe(0);
    });

    it('can handle part of the selected range been collaped', () => {
      actions.setSelectedNode(rootKey, foo1);
      actions.rangeSelectToNode(rootKey, bar2);
      actions.collapseNode(rootKey, foo);
      expect(isSelected(rootKey, bar2)).toBe(true);
      expect(isSelected(rootKey, bar3)).toBe(true);
      expect(isSelected(rootKey, foo)).toBe(true);
      expect(numSelected()).toBe(3);
      actions.rangeSelectToNode(rootKey, bfile);
      expect(isSelected(rootKey, foo)).toBe(true);
      expect(isSelected(rootKey, afile)).toBe(true);
      expect(isSelected(rootKey, bfile)).toBe(true);
      expect(numSelected()).toBe(3);
    });

    it('supports workingset', () => {
      actions.updateWorkingSet(new WorkingSet([bar2, foo, zfile]));
      actions.setSelectedNode(rootKey, foo3);
      actions.rangeSelectToNode(rootKey, zfile);
      expect(isSelected(rootKey, foo3)).toBe(true);
      expect(isSelected(rootKey, zfile)).toBe(true);
      expect(numSelected()).toBe(2);
      controller._rangeSelectUp();
      expect(isSelected(rootKey, foo3)).toBe(true);
      expect(numSelected()).toBe(1);
    });
  });
});
