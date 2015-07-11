'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */
var FileTreeController = require('../lib/FileTreeController');
var fs = require('fs-plus');
var Immutable = require('immutable');
var path = require('path');
var rmdir = require('rimraf');
var temp = require('temp').track();
var timers = require('timers');
var React = require('react-for-atom');
var {TestUtils} = React.addons;

var rootBasenames = [
  'dir1',
  'dir2',
];

function fetchChildrenForNodes(nodes: Array<LazyFileTreeNode>): Promise {
  return Promise.all(nodes.map((node) => node.fetchChildren()));
}

/**
 * Wait for render.
 */
function waitForRender(): Promise {
  return new Promise((resolve, reject) => {
    timers.setImmediate(resolve);
  });
}

/**
 * Verifies that the Nuclide file tree works and that it cleans up its own state.
 *
 * Atom's tests fail if we forget to remove a listener on a Directory, so we don't
 * need to explicitly check for that.
 */
describe('FileTreeController', () => {
  var fileTreeController;
  var treeComponent;
  var fixturesPath;
  var rootNodes;

  beforeEach(() => {
    waitsForPromise(async () => {
      // Set the children of 'fixtures' as the root paths.
      fixturesPath = atom.project.getPaths()[0];
      var rootPaths = rootBasenames.map((basename) => path.join(fixturesPath, basename));
      atom.project.setPaths(rootPaths);

      fileTreeController = new FileTreeController();
      await waitForRender();
      treeComponent = fileTreeController.getTreeComponent();
      rootNodes = treeComponent.getRootNodes();
      await fetchChildrenForNodes(rootNodes);
    });
  });

  afterEach(() => {
    temp.cleanup();
    fileTreeController.destroy();
  });

  xdescribe('deleteSelection', () => {
    it('checks if deleteSelection is called when core:backspace is triggered', () => {
      // Find div element
      var el = React.findDOMNode(TestUtils.findRenderedDOMComponentWithClass(
        fileTreeController._panelController.getChildComponent(),
        'nuclide-file-tree'
      ));
      // mock deleteSelection
      spyOn(fileTreeController, 'deleteSelection');
      atom.commands.dispatch(el, 'core:backspace');
      expect(fileTreeController.deleteSelection.calls.length).toBe(1);
    });

    it('checks if deleteSelection is called when core:delete is triggered', () => {
      // Find div element
      var el = React.findDOMNode(TestUtils.findRenderedDOMComponentWithClass(
        fileTreeController._panelController.getChildComponent(),
        'nuclide-file-tree'
      ));
      // mock deleteSelection
      spyOn(fileTreeController, 'deleteSelection');
      atom.commands.dispatch(el, 'core:delete');
      expect(fileTreeController.deleteSelection.calls.length).toBe(1);
    });
  });

  xdescribe('getNodeAndSetState', () => {
    it('reuses an existing node if possible', () => {
      var rootDirectory = atom.project.getDirectories()[0];
      var originalNode = fileTreeController.getNodeAndSetState(rootDirectory);
      var originalNodeState = fileTreeController.getStateForNodeKey(originalNode.getKey());

      var node = fileTreeController.getNodeAndSetState(rootDirectory);
      var nodeState = fileTreeController.getStateForNodeKey(node.getKey());
      expect(node).toBe(originalNode);
      expect(nodeState).toBe(originalNodeState);
    });
  });

  describe('openDuplicateDialog', () => {
    it('gets called when triggering nuclide-file-tree:duplicate-selection', () => {
      var el = React.findDOMNode(TestUtils.findRenderedDOMComponentWithClass(
        fileTreeController._panelController.getChildComponent(),
        'nuclide-file-tree'
      ));

      // Mock method
      spyOn(fileTreeController, 'openDuplicateDialog');
      atom.commands.dispatch(el, 'nuclide-file-tree:duplicate-selection');
      expect(fileTreeController.openDuplicateDialog.calls.length).toBe(1);
    });
  });
  
  xdescribe('revealActiveFile', () => {
    it('succeeds for a deeply-nested file', () => {
      waitsForPromise(async () => {
        var filePath = path.join(fixturesPath, 'dir1/dir1/dir1/file1');
        await atom.workspace.open(filePath);

        await fileTreeController.revealActiveFile();

        var selectedFilePaths = treeComponent.getSelectedNodes()
            .map(node => node.getItem().getPath());
        expect(selectedFilePaths).toEqual([filePath]);
      });
    });

    it('only expands ancestors for a non-existent file', () => {
      waitsForPromise(async () => {
        var filePath = path.join(fixturesPath, 'dir1/dir1/dir1/unknown');
        await atom.workspace.open(filePath);

        await fileTreeController.revealActiveFile();

        var expandedFilePathsSet = new Set(treeComponent.getExpandedNodes()
            .map(node => node.getItem().getPath()));
        expect(expandedFilePathsSet.has(path.join(fixturesPath, 'dir1'))).toBe(true);
        expect(expandedFilePathsSet.has(path.join(fixturesPath, 'dir1/dir1'))).toBe(true);
        expect(expandedFilePathsSet.has(path.join(fixturesPath, 'dir1/dir1/dir1'))).toBe(true);
        var selectedFilePaths = treeComponent.getSelectedNodes()
            .map(node => node.getItem().getPath());
        expect(selectedFilePaths).toEqual([path.join(fixturesPath, 'dir1/dir1/dir1')]);
      });
    });

    it('does not expand non-existent ancestors', () => {
      waitsForPromise(async () => {
        var filePath = path.join(fixturesPath, 'dir1/dir1/unknown/unknown');
        await atom.workspace.open(filePath);

        await fileTreeController.revealActiveFile();

        var expandedFilePathsSet = new Set(treeComponent.getExpandedNodes()
            .map(node => node.getItem().getPath()));
        expect(expandedFilePathsSet.has(path.join(fixturesPath, 'dir1'))).toBe(true);
        expect(expandedFilePathsSet.has(path.join(fixturesPath, 'dir1/dir1'))).toBe(true);
        expect(expandedFilePathsSet.has(path.join(fixturesPath, 'dir1/dir1/unknown'))).toBe(false);
        var selectedFilePaths = treeComponent.getSelectedNodes()
            .map(node => node.getItem().getPath());
        expect(selectedFilePaths).toEqual([path.join(fixturesPath, 'dir1/dir1')]);
      });
    });
  });

  xdescribe('tests that modify the filesystem', () => {
    var tempPath;
    function getPathsInRoot(paths: Array<string>): Immutable.List<string> {
      return Immutable.List(paths.map(currentPath => path.join(tempPath, currentPath)));
    }

    beforeEach(() => {
      waitsForPromise(async () => {
        // Copy the contents of 'fixtures' into a temp directory and set the root paths.
        tempPath = fs.absolute(temp.mkdirSync());
        fs.copySync(fixturesPath, tempPath);
        var rootPaths = rootBasenames.map((basename) => path.join(tempPath, basename));
        atom.project.setPaths(rootPaths);

        // TODO(jjiaa): Remove the following three lines when we namespace by root directories.
        //
        // The file tree doesn't pick up the new root paths in the temp directory
        // since they have the same basenames as the existing root paths in 'fixtures'.
        fileTreeController.destroy();
        fileTreeController = new FileTreeController();
        await waitForRender();
        treeComponent = fileTreeController.getTreeComponent();

        rootNodes = treeComponent.getRootNodes();
        await fetchChildrenForNodes(rootNodes);
      });
    });

    it('retains cached children when a node\'s siblings change', () => {
      waitsForPromise(async () => {
        var rootNode = rootNodes[0];
        var directoryNode = rootNode.getCachedChildren().get(0);
        var originalChildren = await directoryNode.fetchChildren();
        var originalNodeKeys = originalChildren.map((childNode) => childNode.getKey());
        expect(originalNodeKeys).toEqual(getPathsInRoot(['/dir1/dir1/dir1/', '/dir1/dir1/file1']));

        // Add a new sibling.
        fs.writeFileSync(path.join(rootNode.getItem().getPath(), 'new-file'), '');
        await rootNode.fetchChildren();

        expect(directoryNode.getCachedChildren()).toEqual(originalChildren);
      });
    });

    it('updates when files are added', () => {
      waitsForPromise(async () => {
        var rootNode = rootNodes[0];
        var newFilePath = path.join(rootNode.getItem().getPath(), 'new-file');
        fs.writeFileSync(newFilePath, '');

        var children = await rootNode.fetchChildren();
        var nodeKeys = children.map((childNode) => childNode.getKey());
        expect(nodeKeys).toEqual(getPathsInRoot(['/dir1/dir1/', '/dir1/file1', '/dir1/new-file']));
        var addedNode = children.get(2);
        expect(addedNode.getItem().getPath()).toEqual(newFilePath);
        var addedNodeState = fileTreeController.getStateForNodeKey(addedNode.getKey());
        expect(addedNodeState.node).toBe(addedNode);
        // We should only have listeners for changes in directories, not files.
        expect(addedNodeState.subscription).toBeNull();
      });
    });

    it('updates when directories are added', () => {
      waitsForPromise(async () => {
        var rootNode = rootNodes[0];
        var newDirectoryPath = path.join(rootNode.getItem().getPath(), 'new-directory');
        fs.mkdirSync(newDirectoryPath);

        var children = await rootNode.fetchChildren();
        var nodeKeys = children.map((childNode) => childNode.getKey());
        expect(nodeKeys).toEqual(getPathsInRoot(['/dir1/dir1/', '/dir1/new-directory/', '/dir1/file1']));
        var addedNode = children.get(1);
        expect(addedNode.getItem().getPath()).toEqual(newDirectoryPath);
        var addedNodeState = fileTreeController.getStateForNodeKey(addedNode.getKey());
        expect(addedNodeState.node).toBe(addedNode);
        expect(addedNodeState.subscription).not.toBeNull();
      });
    });

    it('updates when files are removed', () => {
      waitsForPromise(async () => {
        var rootNode = rootNodes[0];
        var fileNode = rootNode.getCachedChildren().get(1);

        var pathToRemove = fileNode.getItem().getPath();
        fs.removeSync(pathToRemove);

        var children = await rootNode.fetchChildren();
        var nodeKeys = children.map((childNode) => childNode.getKey());
        expect(nodeKeys).toEqual(getPathsInRoot(['/dir1/dir1/']));
        expect(fileTreeController.getStateForNodeKey(fileNode.getKey())).toBeUndefined();
      });
    });

    it('updates when directories are removed', () => {
      waitsForPromise(async () => {
        var rootNode = rootNodes[0];
        var directoryNode = rootNode.getCachedChildren().get(0);
        var directoryNodeChildren = await directoryNode.fetchChildren();
        var nestedDirectoryNode = directoryNodeChildren.get(0);

        var pathToRemove = directoryNode.getItem().getPath();
        rmdir.sync(pathToRemove);

        var children = await rootNode.fetchChildren();
        var nodeKeys = children.map((childNode) => childNode.getKey());
        expect(nodeKeys).toEqual(getPathsInRoot(['/dir1/file1']));
        expect(fileTreeController.getStateForNodeKey(directoryNode.getKey())).toBeUndefined();
        expect(fileTreeController.getStateForNodeKey(nestedDirectoryNode.getKey())).toBeUndefined();
      });
    });

    it('updates when files are moved', () => {
      waitsForPromise(async () => {
        var rootNode = rootNodes[0];
        var fileNode = rootNode.getCachedChildren().get(1);

        var [oldKey, newKey] = getPathsInRoot(['/dir1/file1', '/dir1/new-file1']);
        expect(fileNode.getKey()).toEqual(oldKey);

        var sourcePath = fileNode.getItem().getPath();
        var targetPath = path.join(rootNode.getItem().getPath(), 'new-file1');
        fs.moveSync(sourcePath, targetPath);

        var children = await rootNode.fetchChildren();
        var nodeKeys = children.map((childNode) => childNode.getKey());
        expect(nodeKeys).toEqual(getPathsInRoot(['/dir1/dir1/', '/dir1/new-file1']));
        expect(fileTreeController.getStateForNodeKey(oldKey)).toBeUndefined();
        expect(fileTreeController.getStateForNodeKey(newKey)).not.toBeUndefined();
      });
    });

    it('removes treeComponent state when entries are removed', () => {
      waitsForPromise(async () => {
        // Expand the root.
        var rootNode = rootNodes[0];
        var rootNodeChildren = rootNode.getCachedChildren();
        treeComponent.expandNodeKey(rootNode.getKey());
        // Expand the first directory under the first root.
        var directoryNode = rootNodeChildren.get(0);
        treeComponent.expandNodeKey(directoryNode.getKey());
        var directoryNodeChildren = await directoryNode.fetchChildren();
        // And expand its first subdirectory.
        var nestedDirectoryNode = directoryNodeChildren.get(0);
        treeComponent.expandNodeKey(nestedDirectoryNode.getKey());
        await nestedDirectoryNode.fetchChildren();

        rmdir.sync(directoryNode.getItem().getPath());
        await rootNode.fetchChildren();

        var expandedNodes = treeComponent.getExpandedNodes();
        var expandedNodeKeys = expandedNodes.map((node) => node.getKey());
        var rootNodeKeys = rootNodes.map((node) => node.getKey());
        expect(expandedNodeKeys).toEqual(rootNodeKeys);
        var selectedNodes = treeComponent.getSelectedNodes();
        var selectedNodeKeys = selectedNodes.map((node) => node.getKey());
        expect(selectedNodeKeys).toEqual([rootNodeKeys[0]]);
      });
    });
  });
});
