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

import type {GeneratedFileType} from '../../../nuclide-generated-files-rpc';
// $FlowFixMe(>=0.53.0) Flow suppress
import type React from 'react';
import type {FileTreeNode} from '../FileTreeNode';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {WorkingSetsStore} from '../../../nuclide-working-sets/lib/types';
import type {StatusCodeNumberValue} from '../../../nuclide-hg-rpc/lib/types';
import type {
  AppState,
  ExportStoreData,
  FileTreeContextMenuNode,
  NodeDebugState,
  Roots,
} from '../types';

import {objectFromPairs} from 'nuclide-commons/collection';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {StatusCodeNumber} from '../../../nuclide-hg-rpc/lib/hg-constants';
import * as FileTreeHelpers from '../FileTreeHelpers';
import * as Immutable from 'immutable';
import {memoize, once} from 'lodash';
import {createSelector, createSelectorCreator, defaultMemoize} from 'reselect';
import {
  repositoryContainsPath,
  HgStatusToFileChangeStatus,
} from '../../../nuclide-vcs-base';
import {getLogger} from 'log4js';

//
//
// Reselect Utils
//
//

// Create a "selector creator" that uses the object's "equals()" method instead of ===
const createEqualsMethodSelector = createSelectorCreator(
  defaultMemoize,
  (a, b) => a.equals(b),
);

//
//
// Simple selectors. These just read directly from state.
//
//

export const getAutoExpandSingleChild = (state: AppState) =>
  state._autoExpandSingleChild;

export const getFoldersExpanded = (state: AppState) => {
  return state._foldersExpanded;
};

export const getUncommittedChangesExpanded = (state: AppState) => {
  return state._uncommittedChangesExpanded;
};

export const getOpenFilesExpanded = (state: AppState) => {
  return state._openFilesExpanded;
};

export const getRoots = (state: AppState) => {
  return state._roots;
};

// A set of the root URIs. Because this is a set, it's not appropriate when order is important.
const getRootUris: (
  state: AppState,
) => Immutable.Set<NuclideUri> = createEqualsMethodSelector([getRoots], roots =>
  roots.keySeq().toSet(),
);

export const getVersion = (state: AppState) => state.VERSION;

export const getFilter = (state: AppState): string => state._filter;

export const getExtraProjectSelectionContent = (
  state: AppState,
): Immutable.List<React.Element<any>> => state._extraProjectSelectionContent;

const getReorderPreviewStatus = (state: AppState) =>
  state._reorderPreviewStatus;

const getSelectionRange = (state: AppState) => state._selectionRange;

const getTrackedRootKey = (state: AppState) => state._trackedRootKey;

const getTrackedNodeKey = (state: AppState) => state._trackedNodeKey;

export const getWorkingSetsStore = (state: AppState): ?WorkingSetsStore =>
  state._workingSetsStore;

export const getRepositories = (
  state: AppState,
): Immutable.Set<atom$Repository> => state._repositories;

export const getCwdKey = (state: AppState): ?NuclideUri => state._cwdKey;

export const getGeneratedOpenChangedFiles = (
  state: AppState,
): Immutable.Map<NuclideUri, GeneratedFileType> =>
  state._generatedOpenChangedFiles;

export const getIsCalculatingChanges = (state: AppState): boolean =>
  state._isCalculatingChanges;

export const usePrefixNav = (state: AppState): boolean => state._usePrefixNav;

const getSelectedUris = (state: AppState) => state._selectedUris;

const getFocusedUris = (state: AppState) => state._focusedUris;

const getTargetNodeKeys = (state: AppState) => state._targetNodeKeys;

export const getCwdApi = (state: AppState) => state._cwdApi;

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const hasCwd = createSelector([getCwdKey], cwdKey => cwdKey != null);

export const getWorkingSet = (state: AppState) => state.workingSet;

export const getIsEditingWorkingSet = (state: AppState) =>
  state.isEditingWorkingSet;

// Get the VCS statuses for all of the mounted roots.
const getVcsStatuses = createSelector(
  [getRootUris, state => state.vcsStatuses],
  (rootUris, allVcsStatuses) => {
    return rootUris.toMap().map(rootUri => allVcsStatuses.get(rootUri));
  },
);

const getExcludeVcsIgnoredPaths = (state: AppState) =>
  state.excludeVcsIgnoredPaths;

const getHideVcsIgnoredPaths = (state: AppState) => state.hideVcsIgnoredPaths;

const getHideIgnoredNames = (state: AppState) => state.hideIgnoredNames;

const getIgnoredPatterns = (state: AppState) => state.ignoredPatterns;

export const getEditedWorkingSet = (state: AppState) => state.editedWorkingSet;

export const getOpenFilesWorkingSet = (state: AppState) =>
  state.openFilesWorkingSet;

const getReposByRoot = createSelector(
  [getRoots, getRepositories],
  (roots, repos) => {
    const reposByRoot = {};
    roots.forEach(root => {
      reposByRoot[root.uri] = repos.filter(Boolean).find(repo => {
        try {
          return repositoryContainsPath(repo, root.uri);
        } catch (e) {
          // The repo type is not supported.
          return false;
        }
      });
    });
    return reposByRoot;
  },
);

// List the uris between `fromUri` and its ancestor `toUri` (not including `fromUri` but including
// `toUri`).
function* listAncestors(fromUri, toUri) {
  let current = fromUri;
  while (current !== toUri) {
    try {
      current = FileTreeHelpers.getParentKey(current);
    } catch (err) {
      // An invalid URI might cause an exception to be thrown
      getLogger('nuclide-file-tree').error(
        `Error getting parent key of ${current} while enumerating ancestors from ${fromUri} to ${toUri}`,
        err,
      );
      return;
    }
    yield current;
  }
}

// We can't build on the child-derived properties to maintain vcs statuses in the entire tree, since
// the reported VCS status may be for a node that is not yet present in the fetched tree, and so it
// it can't affect its parents statuses. To have the roots colored consistently we manually add all
// parents of all of the modified nodes up till the root
const getEnrichedVcsStatuses = createSelector(
  [getRootUris, getVcsStatuses],
  (rootUris, rawStatuses) => {
    return rootUris
      .toMap()
      .map(rootKey => {
        const rawStatusesForRoot = rawStatuses.get(rootKey) ?? new Map();
        const enrichedStatusesForRoot = new Map(rawStatusesForRoot);
        rawStatusesForRoot.forEach((status, uri) => {
          if (
            status !== StatusCodeNumber.MODIFIED &&
            status !== StatusCodeNumber.ADDED &&
            status !== StatusCodeNumber.REMOVED
          ) {
            return;
          }

          // Set all of the ancestors to "modified."
          for (const ancestorUri of listAncestors(uri, rootKey)) {
            if (enrichedStatusesForRoot.has(ancestorUri)) {
              return;
            }
            enrichedStatusesForRoot.set(ancestorUri, StatusCodeNumber.MODIFIED);
          }
        });
        return enrichedStatusesForRoot;
      })
      .toMap();
  },
);

// We use file changes for populating the uncommitted list, this is different as compared to what is
// computed in the vcsStatuses in that it does not need the exact path but just the root folder
// present in atom and the file name and its status. Another difference is in the terms used for
// status change, while uncommitted changes needs the HgStatusChange codes the file tree doesn't.
// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const getFileChanges = createSelector([getVcsStatuses], vcsStatuses => {
  return vcsStatuses.map(vcsStatusesForRoot => {
    return Immutable.Map(vcsStatusesForRoot).map(
      status => HgStatusToFileChangeStatus[status],
    );
  });
});

//
//
// Tree selectors. These tell us about the state of the directory tree.
//
//

export const getTrackedNode = (state: AppState): ?FileTreeNode => {
  if (state._trackedRootKey == null || state._trackedNodeKey == null) {
    return null;
  }

  return getNode(state, state._trackedRootKey, state._trackedNodeKey);
};

// This doesn't depend on state, so we use `once()` to make sure we don't create
// the inner function every time and invalidate dependent selectors.
export const getNodeIsContainer = once(() =>
  memoizeWithWeakMap((node: FileTreeNode) =>
    FileTreeHelpers.isDirOrArchiveKey(node.uri),
  ),
);

const getContainedInWorkingSet = createSelector(
  [getWorkingSet, getNodeIsContainer],
  (workingSet, getNodeIsContainer_) => {
    return memoizeWithWeakMap(node => {
      const splitPath = nuclideUri.split(node.uri);
      return getNodeIsContainer_(node)
        ? workingSet.containsDirBySplitPath(splitPath)
        : workingSet.containsFileBySplitPath(splitPath);
    });
  },
);

const getContainedInOpenFilesWorkingSet = createSelector(
  [getOpenFilesWorkingSet, getNodeIsContainer],
  (openFilesWorkingSet, getNodeIsContainer_) => {
    return memoizeWithWeakMap(node => {
      if (openFilesWorkingSet.isEmpty()) {
        return false;
      }
      const splitPath = nuclideUri.split(node.uri);
      return getNodeIsContainer_(node)
        ? openFilesWorkingSet.containsDirBySplitPath(splitPath)
        : openFilesWorkingSet.containsFileBySplitPath(splitPath);
    });
  },
);

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const getNodeShouldBeSoftened = createSelector(
  [
    getIsEditingWorkingSet,
    getContainedInWorkingSet,
    getContainedInOpenFilesWorkingSet,
  ],
  (
    isEditingWorkingSet,
    getContainedInWorkingSet_,
    getContainedInOpenFilesWorkingSet_,
  ) => {
    return memoizeWithWeakMap(node => {
      if (isEditingWorkingSet) {
        return false;
      }
      return (
        !getContainedInWorkingSet_(node) &&
        getContainedInOpenFilesWorkingSet_(node)
      );
    });
  },
);

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const getNodeRepo = createSelector([getReposByRoot], reposByRoot => {
  return node => reposByRoot[node.rootUri];
});

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const getNodeIsIgnored = createSelector([getNodeRepo], getNodeRepo_ => {
  return memoizeWithWeakMap(node => {
    const repo = getNodeRepo_(node);
    return (
      repo != null && repo.isProjectAtRoot() && repo.isPathIgnored(node.uri)
    );
  });
});

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const getNodeCheckedStatus = createSelector(
  [getEditedWorkingSet, getNodeIsContainer],
  (editedWorkingSet, getNodeIsContainer_) => {
    return memoizeWithWeakMap(node => {
      if (editedWorkingSet.isEmpty()) {
        return 'clear';
      }
      const splitPath = nuclideUri.split(node.uri);
      if (getNodeIsContainer_(node)) {
        if (editedWorkingSet.containsFileBySplitPath(splitPath)) {
          return 'checked';
        } else if (editedWorkingSet.containsDirBySplitPath(splitPath)) {
          return 'partial';
        }
        return 'clear';
      }
      return editedWorkingSet.containsFileBySplitPath(splitPath)
        ? 'checked'
        : 'clear';
    });
  },
);

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const getNodeShouldBeShown = createSelector(
  [
    getNodeIsIgnored,
    getExcludeVcsIgnoredPaths,
    getHideVcsIgnoredPaths,
    getHideIgnoredNames,
    getIgnoredPatterns,
    getIsEditingWorkingSet,
    getContainedInWorkingSet,
    getContainedInOpenFilesWorkingSet,
  ],
  (
    getNodeIsIgnored_,
    excludeVcsIgnoredPaths,
    hideVcsIgnoredPaths,
    hideIgnoredNames,
    ignoredPatterns,
    isEditingWorkingSet,
    getContainedInWorkingSet_,
    getContainedInOpenFilesWorkingSet_,
  ) => {
    return memoizeWithWeakMap(node => {
      if (
        getNodeIsIgnored_(node) &&
        excludeVcsIgnoredPaths &&
        hideVcsIgnoredPaths
      ) {
        return false;
      }
      if (hideIgnoredNames && ignoredPatterns.some(p => p.match(node.uri))) {
        return false;
      }
      if (isEditingWorkingSet) {
        return true;
      }
      return (
        getContainedInWorkingSet_(node) ||
        getContainedInOpenFilesWorkingSet_(node)
      );
    });
  },
);

// To reduce the number of times we have to iterate over children, we calculate all of these values
// in a single pass.
const getChildDerivedValues = createSelector(
  [getNodeShouldBeShown],
  getNodeShouldBeShown_ => {
    const inner = memoizeWithWeakMap((node: FileTreeNode) => {
      let childrenAreLoading = node.isLoading;
      let containsDragHover = node.isDragHovered;
      let containsFilterMatches = node.matchesFilter;
      let containsHidden = !getNodeShouldBeShown_(node);
      let potentiallyShownChildrenCount = 0;

      node.children.forEach(child => {
        const childValues = inner(child);

        if (childValues.childrenAreLoading) {
          childrenAreLoading = true;
        }

        if (childValues.containsDragHover) {
          containsDragHover = true;
        }

        if (childValues.containsFilterMatches) {
          containsFilterMatches = true;
        }

        if (!containsHidden && childValues.containsHidden) {
          containsHidden = true;
        }

        if (node.isExpanded) {
          potentiallyShownChildrenCount += childValues.shownChildrenCount;
        }
      });

      let shownChildrenCount;
      if (!getNodeShouldBeShown_(node)) {
        shownChildrenCount = 0; // No nodes are shown.
      } else if (node.isPendingLoad && childrenAreLoading) {
        shownChildrenCount = 1; // Only this node is shown.
      } else {
        shownChildrenCount = potentiallyShownChildrenCount + 1; // This node and its children are shown.
      }

      return {
        childrenAreLoading,
        containsDragHover,
        containsFilterMatches,
        containsHidden,
        shownChildrenCount,
      };
    });
    return inner;
  },
);

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const getNodeChildrenAreLoading = createSelector(
  [getChildDerivedValues],
  getChildDerivedValues_ => node =>
    getChildDerivedValues_(node).childrenAreLoading,
);

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const getNodeContainsDragHover = createSelector(
  [getChildDerivedValues],
  getChildDerivedValues_ => node =>
    getChildDerivedValues_(node).containsDragHover,
);

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const getNodeContainsFilterMatches = createSelector(
  [getChildDerivedValues],
  getChildDerivedValues_ => node =>
    getChildDerivedValues_(node).containsFilterMatches,
);

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const getNodeContainsHidden = createSelector(
  [getChildDerivedValues],
  getChildDerivedValues_ => node => getChildDerivedValues_(node).containsHidden,
);

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const getShownChildrenCount = createSelector(
  [getChildDerivedValues],
  getChildDerivedValues_ => node =>
    getChildDerivedValues_(node).shownChildrenCount,
);

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const countShownNodes = createSelector(
  [getRoots, getShownChildrenCount],
  (roots, getShownChildrenCount_) => {
    return roots.reduce((sum, root) => sum + getShownChildrenCount_(root), 0);
  },
);

// FIXME: This is under-memoized. We need to use createSelector and only change when the deps do.
export const getVisualIndex = (
  state: AppState,
): ((node: FileTreeNode) => number) => {
  return memoizeWithWeakMap((node: FileTreeNode) => {
    let index = getNodeShouldBeShown(state)(node) ? 1 : 0;
    let prev = findPrevShownSibling(state)(node);
    while (prev != null) {
      index += getShownChildrenCount(state)(prev);
      prev = findPrevShownSibling(state)(prev);
    }
    return (
      index + (node.parent == null ? 0 : getVisualIndex(state)(node.parent))
    );
  });
};

const getVisualIndexOfTrackedNode = createSelector(
  [getTrackedNode, getVisualIndex],
  (trackedNode, getVisualIndex_) =>
    trackedNode == null ? null : getVisualIndex_(trackedNode),
);

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const getTrackedIndex = createSelector(
  [getVisualIndexOfTrackedNode, countShownNodes],
  (visualIndexOfTrackedNode: ?number, shownNodes: number) => {
    if (visualIndexOfTrackedNode == null) {
      return null;
    }
    const inTreeTrackedNode = visualIndexOfTrackedNode - 1;
    if (inTreeTrackedNode === shownNodes - 1) {
      // The last node in tree is tracked. Let's show the footer instead
      return inTreeTrackedNode + 1;
    }
    return inTreeTrackedNode;
  },
);

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const getRootKeys = createSelector(
  [getRoots],
  (roots): Array<NuclideUri> =>
    roots
      .valueSeq()
      .toArray()
      .map(root => root.uri),
);

/**
 * Returns true if the store has no data, i.e. no roots, no children.
 */
// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const isEmpty = createSelector([getRoots], roots => roots.isEmpty());

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const getSelectedNodes = createSelector(
  [getRoots, getSelectedUris],
  (roots, selectedUris): Immutable.List<FileTreeNode> => {
    const nodes = [];
    selectedUris.forEach((set, rootUri) => {
      set.forEach(uri => {
        const node = getNodeInRoots(roots, rootUri, uri);
        if (node != null) {
          nodes.push(node);
        }
      });
    });
    return Immutable.List(nodes);
  },
);

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const getVisualIndexOfSelectedNodes = createSelector(
  [getSelectedNodes, getVisualIndex],
  (selectedNodes, getVisualIndex_) => selectedNodes.map(getVisualIndex_),
);

export const getNodeInRoots = (
  roots: Roots,
  rootKey: NuclideUri,
  nodeKey: NuclideUri,
): ?FileTreeNode => {
  const rootNode = roots.get(rootKey);
  if (rootNode == null) {
    return null;
  }
  return rootNode.find(nodeKey);
};

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const getFocusedNodes = createSelector(
  [getRoots, getFocusedUris],
  (roots, focusedUris) => {
    const nodes = [];
    focusedUris.forEach((set, rootUri) => {
      set.forEach(uri => {
        const node = getNodeInRoots(roots, rootUri, uri);
        if (node != null) {
          nodes.push(node);
        }
      });
    });
    return Immutable.List(nodes);
  },
);

const getTargetNode = createSelector(
  [getRoots, getTargetNodeKeys],
  (roots, targetNodeKeys) => {
    if (targetNodeKeys == null) {
      return null;
    }
    return getNodeInRoots(
      roots,
      targetNodeKeys.rootKey,
      targetNodeKeys.nodeKey,
    );
  },
);

// Retrieves target node in an immutable list if it's set, or all selected
// nodes otherwise
// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const getTargetNodes = createSelector(
  [getRoots, getTargetNode, getSelectedNodes],
  (roots, targetNode, selectedNodes) => {
    if (targetNode) {
      return Immutable.List([targetNode]);
    }
    return selectedNodes;
  },
);

/**
 * Returns a node if it is the only one selected, or null otherwise
 */
// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const getSingleSelectedNode = createSelector(
  [getSelectedNodes],
  selectedNodes => {
    if (selectedNodes.isEmpty() || selectedNodes.size > 1) {
      return null;
    }
    return selectedNodes.first();
  },
);

// Retrieves the target node, if it's set, or the first selected node otherwise
// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const getSingleTargetNode = createSelector(
  [getTargetNode, getSingleSelectedNode],
  (targetNode, singleSelectedNode) => targetNode ?? singleSelectedNode,
);

/**
 * Returns the current node if it is shown.
 * Otherwise, returns a nearby node that is shown.
 */
function findShownNode(state: AppState, node: FileTreeNode): ?FileTreeNode {
  if (getNodeShouldBeShown(state)(node)) {
    return node;
  }

  let shown = node;
  while (shown != null) {
    const next = findNextShownSibling(state)(shown);
    if (next != null) {
      return next;
    }
    shown = shown.parent;
  }

  shown = node;
  while (shown != null) {
    const next = findPrevShownSibling(state)(shown);
    if (next != null) {
      return next;
    }
    shown = shown.parent;
  }
  return null;
}

/**
 * Returns the current node if it is shown and selected
 * Otherwise, returns a nearby selected node.
 */
export const getNearbySelectedNode = (
  state: AppState,
  node: FileTreeNode,
): ?FileTreeNode => {
  const shown = findShownNode(state, node);
  if (shown == null) {
    return shown;
  }
  if (getNodeIsSelected(state)(shown)) {
    return shown;
  }
  let selected = shown;
  while (selected != null && !getNodeIsSelected(state)(selected)) {
    selected = findNext(state)(selected);
  }
  if (selected != null) {
    return selected;
  }
  selected = shown;
  while (selected != null && !getNodeIsSelected(state)(selected)) {
    selected = findPrevious(state)(selected);
  }
  return selected;
};

export const getNode = (
  state: AppState,
  rootKey: NuclideUri,
  nodeKey: NuclideUri,
): ?FileTreeNode => getNodeInRoots(getRoots(state), rootKey, nodeKey);

export const getRootForPath = (
  state: AppState,
  nodeKey: NuclideUri,
): ?FileTreeNode => {
  const rootNode = getRoots(state).find(root => nodeKey.startsWith(root.uri));
  return rootNode || null;
};

export const getNodeForPath = (
  state: AppState,
  uri: NuclideUri,
): ?FileTreeNode => {
  const rootNode = getRootForPath(state, uri);
  return rootNode && rootNode.find(uri);
};

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const isEditedWorkingSetEmpty = createSelector(
  [getRoots, getNodeCheckedStatus],
  (roots, getNodeCheckedStatus_) =>
    roots.every(root => getNodeCheckedStatus_(root) === 'clear'),
);

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const getFilterFound = createSelector(
  [getRoots, getNodeContainsFilterMatches],
  (roots, getNodeContainsFilterMatches_) =>
    roots.some(root => getNodeContainsFilterMatches_(root)),
);

/**
 * Find the node that occurs `offset` after the provided one in the flattened list. `offset` must
 * be a non-negative integer.
 *
 * This function is intentionally implemented with a loop instead of recursion. Previously it was
 * implemented using recursion, which caused the stack size to grow with the number of siblings we
 * had to traverse. That meant we exceeded the max stack size with enough sibling files.
 */
const getFindNodeAtOffset = createSelector(
  [findNextShownSibling, getShownChildrenCount, getNodeShouldBeShown],
  (findNextShownSibling_, getShownChildrenCount_, getNodeShouldBeShown_) => {
    return function(node_: FileTreeNode, offset_: number): ?FileTreeNode {
      let offset = offset_;
      let node = node_;

      while (offset > 0) {
        if (
          offset < getShownChildrenCount_(node) // `shownChildrenCount` includes the node itself.
        ) {
          // It's a descendant of this node!
          const firstVisibleChild = node.children.find(c =>
            getNodeShouldBeShown_(c),
          );
          if (firstVisibleChild == null) {
            return null;
          }
          offset--;
          node = firstVisibleChild;
        } else {
          const nextShownSibling = findNextShownSibling_(node);
          if (nextShownSibling == null) {
            return null;
          }
          offset -= getShownChildrenCount_(node);
          node = nextShownSibling;
        }
      }

      return node;
    };
  },
);

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const getNodeByIndex = createSelector(
  [getRoots, getFindNodeAtOffset, getNodeShouldBeShown],
  (roots, findNodeAtOffset, getNodeShouldBeShown_) => {
    return memoize(index => {
      const firstRoot = roots.find(r => getNodeShouldBeShown_(r));
      return firstRoot == null ? null : findNodeAtOffset(firstRoot, index - 1);
    });
  },
);

export const getLoading = (state: AppState, nodeKey: NuclideUri) =>
  state._isLoadingMap.get(nodeKey);

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const getNodeIsSelected = createSelector(
  [getSelectedUris],
  selectedUris => {
    return memoizeWithWeakMap(node =>
      selectedUris.get(node.rootUri, Immutable.Set()).has(node.uri),
    );
  },
);

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const getNodeIsFocused = createSelector(
  [getFocusedUris],
  focusedUris => {
    return memoizeWithWeakMap(node =>
      focusedUris.get(node.rootUri, Immutable.Set()).has(node.uri),
    );
  },
);

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const getSidebarTitle = createSelector([getCwdKey], cwdKey => {
  return cwdKey == null ? 'File Tree' : nuclideUri.basename(cwdKey);
});

export const getUsePreviewTabs = (state: AppState): boolean => {
  return state.usePreviewTabs;
};

export const getFocusEditorOnFileSelection = (state: AppState): boolean => {
  return state.focusEditorOnFileSelection;
};

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const getSidebarPath = createSelector([getCwdKey], cwdKey => {
  if (cwdKey == null) {
    return 'No Current Working Directory';
  }

  const trimmed = nuclideUri.trimTrailingSeparator(cwdKey);
  const directory = nuclideUri.getPath(trimmed);
  const host = nuclideUri.getHostnameOpt(trimmed);
  if (host == null) {
    return `Current Working Directory: ${directory}`;
  }

  return `Current Working Directory: '${directory}' on '${host}'`;
});

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const getVcsStatus = createSelector(
  [getEnrichedVcsStatuses],
  (
    vcsStatusesByRoot: Immutable.Map<
      NuclideUri,
      Map<NuclideUri, StatusCodeNumberValue>,
    >,
  ): ((node: FileTreeNode) => StatusCodeNumberValue) => {
    return node => {
      const statusMap = vcsStatusesByRoot.get(node.rootUri);
      return statusMap == null
        ? StatusCodeNumber.CLEAN
        : statusMap.get(node.uri) ?? StatusCodeNumber.CLEAN;
    };
  },
);

// In previous versions, we exposed the FileTreeNodes directly. This was bad as it's really just an
// implementation detail. So, when we wanted to move `vcsStatus` off of the node, we had an issue.
// We now expose a limited API instead to avoid this.
// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const getFileTreeContextMenuNode = createSelector(
  [getVcsStatus, getNodeRepo, getNodeIsContainer],
  (getVcsStatusFromNode, getNodeRepo_, getNodeIsContainer_) => {
    return (node: ?FileTreeNode): ?FileTreeContextMenuNode => {
      if (node == null) {
        return null;
      }
      return {
        uri: node.uri,
        isContainer: getNodeIsContainer_(node),
        isRoot: node.isRoot,
        isCwd: node.isCwd,
        vcsStatusCode: getVcsStatusFromNode(node),
        repo: getNodeRepo_(node),
        // We don't want to expose the entire tree or allow traversal since then we'd have to
        // materialize every node. This is for supporting a legacy use case.
        parentUri: node.parent?.uri,
      };
    };
  },
);

//
//
// Serialization and debugging
//
//

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const serialize = createSelector(
  [
    getRootKeys,
    getVersion,
    getOpenFilesExpanded,
    getUncommittedChangesExpanded,
    getFoldersExpanded,
  ],
  (
    rootKeys,
    version,
    openFilesExpanded,
    uncommittedChangesExpanded,
    foldersExpanded,
  ): ExportStoreData => {
    return {
      version,
      childKeyMap: {},
      expandedKeysByRoot: {},
      rootKeys,
      selectedKeysByRoot: {},
      openFilesExpanded,
      uncommittedChangesExpanded,
      foldersExpanded,
    };
  },
);

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const collectSelectionDebugState = createSelector(
  [getSelectedNodes, getFocusedNodes],
  (selectedNodes, focusedNodes) => {
    return {
      // $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
      _selectedNodes: selectedNodes.toArray().map(node => node.uri),
      // $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
      _focusedNodes: focusedNodes.toArray().map(node => node.uri),
    };
  },
);

export const getCanTransferFiles = (state: AppState) =>
  Boolean(state.remoteTransferService);

const collectDebugStateForNode = (state: AppState) => (
  node: FileTreeNode,
): json$JsonObject => {
  // We jump through some hoops here to make sure that the return value is both a valid
  // `NodeDebugState` and JSON serializable. This prevents us from accidentally trying to serialize
  // a Map, for example.
  // See <https://github.com/facebook/flow/issues/4825#issuecomment-424077876> for details.
  const serialized: json$JsonObject = {
    uri: node.uri,
    rootUri: node.rootUri,
    isExpanded: node.isExpanded,
    isDragHovered: node.isDragHovered,
    isBeingReordered: node.isBeingReordered,
    isLoading: node.isLoading,
    wasFetched: node.wasFetched,
    isCwd: node.isCwd,
    connectionTitle: node.connectionTitle,
    highlightedText: node.highlightedText,
    matchesFilter: node.matchesFilter,
    isPendingLoad: node.isPendingLoad,
    generatedStatus: node.generatedStatus,
    isRoot: node.isRoot,
    name: node.name,
    relativePath: node.relativePath,
    localPath: node.localPath,
    isContainer: getNodeIsContainer(state)(node),
    shouldBeShown: getNodeShouldBeShown(state)(node),
    shouldBeSoftened: getNodeShouldBeSoftened(state)(node),
    isIgnored: getNodeIsIgnored(state)(node),
    checkedStatus: getNodeCheckedStatus(state)(node),
  };
  const withChildren: NodeDebugState = {
    ...serialized,
    children: Array.from(node.children.values()).map(child =>
      collectDebugStateForNode(state)(child),
    ),
  };
  return ((withChildren: any): json$JsonObject);
};

// Note: The Flow types for reselect's `createSelector` only support up to 16
// sub-selectors. Since this selector only gets called when the user reports a
// bug, it does not need to be optimized for multiple consecutive calls on
// similar states. Therefore, we've opted to not use createSelector for this
// selector.
export const collectDebugState = (state: AppState): json$JsonObject => {
  const selectionRange = getSelectionRange(state);
  const serializedSelectionRange =
    selectionRange == null ? null : selectionRange.serialize();

  const vcsStatuses = {};
  for (const [key, value] of getEnrichedVcsStatuses(state).entries()) {
    vcsStatuses[key] = objectFromPairs(value.entries());
  }

  const fileChanges = {};
  for (const [key, value] of getFileChanges(state).entries()) {
    fileChanges[key] = objectFromPairs(value.entries());
  }

  return {
    currentWorkingRoot: getCwdKey(state),
    openFilesExpanded: getOpenFilesExpanded(state),
    uncommittedChangesExpanded: getUncommittedChangesExpanded(state),
    foldersExpanded: getFoldersExpanded(state),
    reorderPreviewStatus: {...getReorderPreviewStatus(state)},
    _filter: getFilter(state),
    _selectionRange: serializedSelectionRange,
    _targetNodeKeys: {...getTargetNodeKeys(state)},
    _trackedRootKey: getTrackedRootKey(state),
    _trackedNodeKey: getTrackedNodeKey(state),
    _isCalculatingChanges: getIsCalculatingChanges(state),
    usePreviewTabs: getUsePreviewTabs(state),
    focusEditorOnFileSelection: getFocusEditorOnFileSelection(state),
    roots: Array.from(getRoots(state).values()).map(root =>
      collectDebugStateForNode(state)(root),
    ),
    _conf: {
      hideIgnoredNames: getHideIgnoredNames(state),
      excludeVcsIgnoredPaths: getExcludeVcsIgnoredPaths(state),
      hideVcsIgnoredPaths: getHideVcsIgnoredPaths(state),
      isEditingWorkingSet: getIsEditingWorkingSet(state),
      vcsStatuses,
      fileChanges,
      workingSet: [...getWorkingSet(state).getUris()],
      ignoredPatterns: [
        ...getIgnoredPatterns(state)
          .toArray()
          .map(ignored => ignored.pattern),
      ],
      openFilesWorkingSet: [...getOpenFilesWorkingSet(state).getUris()],
      editedWorkingSet: [...getEditedWorkingSet(state).getUris()],
    },
    selectionManager: collectSelectionDebugState(state),
  };
};

//
//
// Traversal utils
//
//

/**
 * Finds the next node in the tree in the natural order - from top to to bottom as is displayed
 * in the file-tree panel, minus the indentation. Only the nodes that should be shown are returned.
 */
export function findNext(state: AppState) {
  return (node: FileTreeNode): ?FileTreeNode => {
    if (!getNodeShouldBeShown(state)(node)) {
      if (node.parent != null) {
        return findNext(state)(node.parent);
      }

      return null;
    }

    if (getShownChildrenCount(state)(node) > 1) {
      return node.children.find(c => getNodeShouldBeShown(state)(c));
    }

    // Not really an alias, but an iterating reference
    let it = node;
    while (it != null) {
      const nextShownSibling = findNextShownSibling(state)(it);
      if (nextShownSibling != null) {
        return nextShownSibling;
      }

      it = it.parent;
    }

    return null;
  };
}

export function findNextShownSibling(state: AppState) {
  return (node: FileTreeNode): ?FileTreeNode => {
    let it = node.nextSibling;
    while (it != null && !getNodeShouldBeShown(state)(it)) {
      it = it.nextSibling;
    }

    return it;
  };
}

/**
 * Finds the previous node in the tree in the natural order - from top to to bottom as is displayed
 * in the file-tree panel, minus the indentation. Only the nodes that should be shown are returned.
 */
export function findPrevious(state: AppState) {
  return (node: FileTreeNode): ?FileTreeNode => {
    if (!getNodeShouldBeShown(state)(node)) {
      if (node.parent != null) {
        return findPrevious(state)(node.parent);
      }

      return null;
    }

    const prevShownSibling = findPrevShownSibling(state)(node);
    if (prevShownSibling != null) {
      return findLastRecursiveChild(state)(prevShownSibling);
    }

    return node.parent;
  };
}

export function findPrevShownSibling(state: AppState) {
  return (node: FileTreeNode): ?FileTreeNode => {
    let it = node.prevSibling;
    while (it != null && !getNodeShouldBeShown(state)(it)) {
      it = it.prevSibling;
    }

    return it;
  };
}

/**
 * Returns the last shown descendant according to the natural tree order as is to be displayed by
 * the file-tree panel. (Last child of the last child of the last child...)
 * Or null, if none are found
 */
export function findLastRecursiveChild(state: AppState) {
  // TODO: Convert this to use `createSelector()`
  return (node: FileTreeNode): ?FileTreeNode => {
    if (
      !getNodeIsContainer(state)(node) ||
      !node.isExpanded ||
      node.children.isEmpty()
    ) {
      return node;
    }

    let it = node.children.last();
    while (it != null && !getNodeShouldBeShown(state)(it)) {
      it = it.prevSibling;
    }

    if (it == null) {
      if (getNodeShouldBeShown(state)(node)) {
        return node;
      }
      return findPrevious(state)(node);
    } else {
      return findLastRecursiveChild(state)(it);
    }
  };
}

//
//
// Utilities
//
//

function memoizeWithWeakMap<T, U>(fn: T => U): T => U {
  const memoized = memoize(fn);
  memoized.cache = new WeakMap();
  return memoized;
}
