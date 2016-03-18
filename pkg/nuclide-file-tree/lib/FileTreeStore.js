'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {HgRepositoryClient} from '../../nuclide-hg-repository-client';
import type {
  RemoteDirectory,
  RemoteFile,
} from '../../nuclide-remote-connection';

import FileTreeDispatcher from './FileTreeDispatcher';
import FileTreeHelpers from './FileTreeHelpers';
import FileTreeNode from './FileTreeNode';
import Immutable from 'immutable';
import {ActionType} from './FileTreeConstants';
import {Disposable, Emitter} from 'atom';
import {Minimatch} from 'minimatch';
import {repositoryContainsPath} from '../../nuclide-hg-git-bridge';
import {repositoryForPath} from '../../nuclide-hg-git-bridge';
import {StatusCodeNumber} from '../../nuclide-hg-repository-base/lib/hg-constants';

import {array} from '../../nuclide-commons';
import {getLogger} from '../../nuclide-logging';
import {object as objectUtil} from '../../nuclide-commons';
import shell from 'shell';
import memoize from 'lodash.memoize';

import {WorkingSet} from '../../nuclide-working-sets';

// Used to ensure the version we serialized is the same version we are deserializing.
const VERSION = 1;

import type {Dispatcher} from 'flux';
import type {NuclideUri} from '../../nuclide-remote-uri';
import type {WorkingSetsStore} from '../../nuclide-working-sets/lib/WorkingSetsStore';


type ActionPayload = Object;
type ChangeListener = () => mixed;

export type FileTreeNodeData = {
  nodeKey: string;
  rootKey: string;
}

type StoreData = {
  cwdKey: ?string;
  filter: ?string;
  filterFound: ?boolean;
  childKeyMap: { [key: string]: Array<string> };
  isDirtyMap: { [key: string]: boolean };
  expandedKeysByRoot: { [key: string]: Immutable.Set<string> };
  trackedNode: ?FileTreeNodeData;
  // Saves a list of child nodes that should be expande when a given key is expanded.
  // Looks like: { rootKey: { nodeKey: [childKey1, childKey2] } }.
  previouslyExpanded: { [rootKey: string]: Immutable.Map<string, Array<String>> };
  isLoadingMap: { [key: string]: ?Promise };
  rootKeys: Array<string>;
  selectedKeysByRoot: { [key: string]: Immutable.OrderedSet<string> };
  subscriptionMap: { [key: string]: Disposable };
  vcsStatusesByRoot: { [key: string]: Immutable.Map<string, number> };
  ignoredPatterns: Immutable.Set<Minimatch>;
  hideIgnoredNames: boolean;
  excludeVcsIgnoredPaths: boolean;
  usePreviewTabs: boolean;
  usePrefixNav: boolean;
  repositories: Immutable.Set<atom$Repository>;
  workingSet: WorkingSet;
  openFilesWorkingSet: WorkingSet;
  workingSetsStore: ?WorkingSetsStore;
  isEditingWorkingSet: boolean;
  editedWorkingSet: WorkingSet;
};

export type ExportStoreData = {
  childKeyMap: { [key: string]: Array<string> };
  expandedKeysByRoot: { [key: string]: Array<string> };
  rootKeys: Array<string>;
  selectedKeysByRoot: { [key: string]: Array<string> };
  version: number;
};

let instance: ?Object;

/**
 * Implements the Flux pattern for our file tree. All state for the file tree will be kept in
 * FileTreeStore and the only way to update the store is through methods on FileTreeActions. The
 * dispatcher is a mechanism through which FileTreeActions interfaces with FileTreeStore.
 */
class FileTreeStore {
  _data: StoreData;
  _dispatcher: Dispatcher;
  _emitter: Emitter;
  _logger: any;
  _timer: ?Object;
  _repositoryForPath: (path: NuclideUri) => ?atom$Repository;

  static getInstance(): FileTreeStore {
    if (!instance) {
      instance = new FileTreeStore();
    }
    return instance;
  }

  constructor() {
    this._data = this._getDefaults();
    this._dispatcher = FileTreeDispatcher.getInstance();
    this._emitter = new Emitter();
    this._dispatcher.register(
      payload => this._onDispatch(payload)
    );
    this._logger = getLogger();
    this._repositoryForPath = memoize(this._repositoryForPath);
  }

  /**
   * TODO: Move to a [serialization class][1] and use the built-in versioning mechanism. This might
   * need to be done one level higher within main.js.
   *
   * [1]: https://atom.io/docs/latest/behind-atom-serialization-in-atom
   */
  exportData(): ExportStoreData {
    const data = this._data;
    // Grab the child keys of only the expanded nodes.
    const childKeyMap = {};
    Object.keys(data.expandedKeysByRoot).forEach(rootKey => {
      const expandedKeySet = data.expandedKeysByRoot[rootKey];
      for (const nodeKey of expandedKeySet) {
        childKeyMap[nodeKey] = data.childKeyMap[nodeKey];
      }
    });
    return {
      version: VERSION,
      childKeyMap: childKeyMap,
      expandedKeysByRoot: mapValues(data.expandedKeysByRoot, keySet => keySet.toArray()),
      rootKeys: data.rootKeys,
      selectedKeysByRoot: mapValues(data.selectedKeysByRoot, keySet => keySet.toArray()),
    };
  }

  /**
   * Imports store data from a previous export.
   */
  loadData(data: ExportStoreData): void {
    // Ensure we are not trying to load data from an earlier version of this package.
    if (data.version !== VERSION) {
      return;
    }
    this._data = {
      ...this._getDefaults(),
      childKeyMap: data.childKeyMap,
      expandedKeysByRoot: mapValues(data.expandedKeysByRoot, keys => new Immutable.Set(keys)),
      rootKeys: data.rootKeys,
      selectedKeysByRoot:
        mapValues(data.selectedKeysByRoot, keys => new Immutable.OrderedSet(keys)),
    };
    Object.keys(data.childKeyMap).forEach(nodeKey => {
      this._addSubscription(nodeKey);
      this._fetchChildKeys(nodeKey);
    });
  }

  _setExcludeVcsIgnoredPaths(excludeVcsIgnoredPaths: boolean): void {
    this._set('excludeVcsIgnoredPaths', excludeVcsIgnoredPaths);
  }

  _setHideIgnoredNames(hideIgnoredNames: boolean): void {
    this._set('hideIgnoredNames', hideIgnoredNames);
  }

  /**
   * Given a list of names to ignore, compile them into minimatch patterns and
   * update the store with them.
   */
  _setIgnoredNames(ignoredNames: Array<string>) {
    const ignoredPatterns = Immutable.Set(ignoredNames)
      .map(ignoredName => {
        if (ignoredName === '') {
          return null;
        }
        try {
          return new Minimatch(ignoredName, {matchBase: true, dot: true});
        } catch (error) {
          atom.notifications.addWarning(
            `Error parsing pattern '${ignoredName}' from "Settings" > "Ignored Names"`,
            {detail: error.message},
          );
          return null;
        }
      })
      .filter(pattern => pattern != null);
    this._set('ignoredPatterns', ignoredPatterns);
  }

  _getDefaults(): StoreData {
    return {
      cwdKey: null,
      childKeyMap: {},
      isDirtyMap: {},
      expandedKeysByRoot: {},
      trackedNode: null,
      previouslyExpanded: {},
      isLoadingMap: {},
      rootKeys: [],
      selectedKeysByRoot: {},
      subscriptionMap: {},
      vcsStatusesByRoot: {},
      ignoredPatterns: Immutable.Set(),
      hideIgnoredNames: true,
      excludeVcsIgnoredPaths: true,
      usePreviewTabs: false,
      usePrefixNav: true,
      repositories: Immutable.Set(),
      workingSet: new WorkingSet(),
      openFilesWorkingSet: new WorkingSet(),
      workingSetsStore: null,
      isEditingWorkingSet: false,
      editedWorkingSet: new WorkingSet(),
    };
  }

  _onDispatch(payload: ActionPayload): void {
    switch (payload.actionType) {
      case ActionType.DELETE_SELECTED_NODES:
        this._deleteSelectedNodes().catch(error => {
          atom.notifications.addError('Deleting nodes failed with an error: ' + error.toString());
        });
        break;
      case ActionType.SET_CWD:
        this._setCwdKey(payload.rootKey);
        break;
      case ActionType.SET_TRACKED_NODE:
        this._setTrackedNode(payload.rootKey, payload.nodeKey);
        break;
      case ActionType.SET_ROOT_KEYS:
        this._setRootKeys(payload.rootKeys);
        break;
      case ActionType.EXPAND_NODE:
        this._expandNode(payload.rootKey, payload.nodeKey);
        break;
      case ActionType.EXPAND_NODE_DEEP:
        this._expandNodeDeep(payload.rootKey, payload.nodeKey);
        break;
      case ActionType.COLLAPSE_NODE:
        this._collapseNode(payload.rootKey, payload.nodeKey);
        break;
      case ActionType.SET_EXCLUDE_VCS_IGNORED_PATHS:
        this._setExcludeVcsIgnoredPaths(payload.excludeVcsIgnoredPaths);
        break;
      case ActionType.SET_USE_PREVIEW_TABS:
        this._setUsePreviewTabs(payload.usePreviewTabs);
        break;
      case ActionType.SET_USE_PREFIX_NAV:
        this._setUsePrefixNav(payload.usePrefixNav);
        break;
      case ActionType.COLLAPSE_NODE_DEEP:
        this._purgeDirectoryWithinARoot(payload.rootKey, payload.nodeKey, /* unselect */false);
        break;
      case ActionType.SET_HIDE_IGNORED_NAMES:
        this._setHideIgnoredNames(payload.hideIgnoredNames);
        break;
      case ActionType.SET_IGNORED_NAMES:
        this._setIgnoredNames(payload.ignoredNames);
        break;
      case ActionType.SET_SELECTED_NODES_FOR_ROOT:
        this._setSelectedKeys(payload.rootKey, payload.nodeKeys);
        break;
      case ActionType.SET_SELECTED_NODES_FOR_TREE:
        this._setSelectedKeysByRoot(payload.selectedKeysByRoot);
        break;
      case ActionType.CREATE_CHILD:
        this._createChild(payload.nodeKey, payload.childKey);
        break;
      case ActionType.SET_VCS_STATUSES:
        this._setVcsStatuses(payload.rootKey, payload.vcsStatuses);
        break;
      case ActionType.SET_REPOSITORIES:
        this._setRepositories(payload.repositories);
        break;
      case ActionType.SET_WORKING_SET:
        this._setWorkingSet(payload.workingSet);
        break;
      case ActionType.SET_OPEN_FILES_WORKING_SET:
        this._setOpenFilesWorkingSet(payload.openFilesWorkingSet);
        break;
      case ActionType.SET_WORKING_SETS_STORE:
        this._setWorkingSetsStore(payload.workingSetsStore);
        break;
      case ActionType.START_EDITING_WORKING_SET:
        this._startEditingWorkingSet(payload.editedWorkingSet);
        break;
      case ActionType.FINISH_EDITING_WORKING_SET:
        this._finishEditingWorkingSet();
        break;
      case ActionType.CHECK_NODE:
        this._checkNode(payload.rootKey, payload.nodeKey);
        break;
      case ActionType.UNCHECK_NODE:
        this._uncheckNode(payload.rootKey, payload.nodeKey);
        break;
    }
  }

  /**
   * This is a private method because in Flux we should never externally write to the data store.
   * Only by receiving actions (from dispatcher) should the data store be changed.
   * Note: `_set` can be called multiple times within one iteration of an event loop without
   * thrashing the UI because we are using setImmediate to batch change notifications, effectively
   * letting our views re-render once for multiple consecutive writes.
   */
  _set(key: string, value: mixed, flush: boolean = false): void {
    const oldData = this._data;
    // Immutability for the win!
    const newData = setProperty(this._data, key, value);
    if (newData !== oldData) {
      this._data = newData;
      clearImmediate(this._timer);
      if (flush) {
        // If `flush` is true, emit the change immediately.
        this._emitter.emit('change');
      } else {
        // If not flushing, de-bounce to prevent successive updates in the same event loop.
        this._timer = setImmediate(() => {
          this._emitter.emit('change');
        });
      }
    }
  }

  getTrackedNode(): ?FileTreeNodeData {
    return this._data.trackedNode;
  }

  getRepositories(): Immutable.Set<atom$Repository> {
    return this._data.repositories;
  }

  getWorkingSet(): WorkingSet {
    return this._data.workingSet;
  }

  getOpenFilesWorkingSet(): WorkingSet {
    return this._data.openFilesWorkingSet;
  }

  getWorkingSetsStore(): ?WorkingSetsStore {
    return this._data.workingSetsStore;
  }

  getRootKeys(): Array<string> {
    return this._data.rootKeys;
  }

  /**
   * Returns the key of the *first* root node containing the given node.
   */
  getRootForKey(nodeKey: string): ?string {
    return array.find(this._data.rootKeys, rootKey => nodeKey.startsWith(rootKey));
  }

  /**
   * Returns true if the store has no data, i.e. no roots, no children.
   */
  isEmpty(): boolean {
    return this.getRootKeys().length === 0;
  }

  /**
   * Note: We actually don't need rootKey (implementation detail) but we take it for consistency.
   */
  isLoading(rootKey: string, nodeKey: string): boolean {
    return !!this._getLoading(nodeKey);
  }

  isExpanded(rootKey: string, nodeKey: string): boolean {
    return this._getExpandedKeys(rootKey).has(nodeKey);
  }

  isRootKey(nodeKey: string): boolean {
    return this._data.rootKeys.indexOf(nodeKey) !== -1;
  }

  isSelected(rootKey: string, nodeKey: string): boolean {
    return this.getSelectedKeys(rootKey).has(nodeKey);
  }

  _setVcsStatuses(rootKey: string, vcsStatuses: {[path: string]: number}) {
    const immutableVcsStatuses = new Immutable.Map(vcsStatuses);
    if (!Immutable.is(immutableVcsStatuses, this._data.vcsStatusesByRoot[rootKey])) {
      this._set(
        'vcsStatusesByRoot',
        setProperty(this._data.vcsStatusesByRoot, rootKey, immutableVcsStatuses)
      );
    }
  }

  getVcsStatusCode(rootKey: string, nodeKey: string): ?number {
    const map = this._data.vcsStatusesByRoot[rootKey];
    if (map) {
      return map.get(nodeKey);
    } else {
      return null;
    }
  }

  _setUsePreviewTabs(usePreviewTabs: boolean) {
    this._set('usePreviewTabs', usePreviewTabs);
  }

  _setUsePrefixNav(usePrefixNav: boolean) {
    this._set('usePrefixNav', usePrefixNav);
  }

  usePreviewTabs(): boolean {
    return this._data.usePreviewTabs;
  }

  usePrefixNav(): boolean {
    return this._data.usePrefixNav;
  }

  /**
   * Returns known child keys for the given `nodeKey` but does not queue a fetch for missing
   * children like `::getChildKeys`.
   */
  getCachedChildKeys(rootKey: string, nodeKey: string): Array<string> {
    return this._omitHiddenPaths(this._data.childKeyMap[nodeKey] || []);
  }

  /**
   * The node child keys may either be available immediately (cached), or
   * require an async fetch. If all of the children are needed it's easier to
   * return as promise, to make the caller oblivious to the way children were
   * fetched.
   */
  promiseNodeChildKeys(rootKey: string, nodeKey: string): Promise {
    const cachedChildKeys = this.getChildKeys(rootKey, nodeKey);
    if (cachedChildKeys.length) {
      return Promise.resolve(cachedChildKeys);
    }

    const promise = this._getLoading(nodeKey) || Promise.resolve();
    return promise.then(() => this.getCachedChildKeys(rootKey, nodeKey));
  }

  /**
   * Returns known child keys for the given `nodeKey` and queues a fetch if children are missing.
   */
  getChildKeys(rootKey: string, nodeKey: string): Array<string> {
    const childKeys = this._data.childKeyMap[nodeKey];
    if (childKeys == null || this._data.isDirtyMap[nodeKey]) {
      this._fetchChildKeys(nodeKey);
    } else {
      /*
       * If no data needs to be fetched, wipe out the scrolling state because subsequent updates
       * should no longer scroll the tree. The node will have already been flushed to the view and
       * scrolled to.
       */
      this._checkTrackedNode();
    }
    return this._omitHiddenPaths(childKeys || []);
  }

  getSelectedKeys(rootKey?: string): Immutable.OrderedSet<string> {
    let selectedKeys;
    if (rootKey == null) {
      selectedKeys = new Immutable.OrderedSet();
      for (const root in this._data.selectedKeysByRoot) {
        if (this._data.selectedKeysByRoot.hasOwnProperty(root)) {
          selectedKeys = selectedKeys.merge(this._data.selectedKeysByRoot[root]);
        }
      }
    } else {
      // If the given `rootKey` has no selected keys, assign an empty set to maintain a non-null
      // return value.
      selectedKeys = this._data.selectedKeysByRoot[rootKey] || new Immutable.OrderedSet();
    }
    return selectedKeys;
  }

  /**
   * Returns a list of the nodes that are currently visible/expanded in the file tree.
   *
   * This method returns an array synchronously (rather than an iterator) to ensure the caller
   * gets a consistent snapshot of the current state of the file tree.
   */
  getVisibleNodes(rootKey: string): Array<FileTreeNode> {
    // Do some basic checks to ensure that rootKey corresponds to a root and is expanded. If not,
    // return the appropriate array.
    if (!this.isRootKey(rootKey)) {
      return [];
    }
    if (!this.isExpanded(rootKey, rootKey)) {
      return [this.getNode(rootKey, rootKey)];
    }

    // Note that we could cache the visibleNodes array so that we do not have to create it from
    // scratch each time this is called, but it does not appear to be a bottleneck at present.
    const visibleNodes = [];
    const rootKeysForDirectoriesToExplore = [rootKey];
    while (rootKeysForDirectoriesToExplore.length !== 0) {
      const key = rootKeysForDirectoriesToExplore.pop();
      visibleNodes.push(this.getNode(key, key));
      const childKeys = this._data.childKeyMap[key];
      if (childKeys == null || this._data.isDirtyMap[key]) {
        // This is where getChildKeys() would fetch, but we do not want to do that.
        // TODO: If key is in isDirtyMap, then retry when it is not dirty?
        continue;
      }

      for (const childKey of childKeys) {
        if (FileTreeHelpers.isDirKey(childKey)) {
          if (this.isExpanded(rootKey, key)) {
            rootKeysForDirectoriesToExplore.push(childKey);
          }
        } else {
          visibleNodes.push(this.getNode(key, childKey));
        }
      }
    }
    return visibleNodes;
  }

  /**
   * Returns all selected nodes across all roots in the tree.
   */
  getSelectedNodes(): Immutable.OrderedSet<FileTreeNode> {
    let selectedNodes = new Immutable.OrderedSet();
    this._data.rootKeys.forEach(rootKey => {
      this.getSelectedKeys(rootKey).forEach(nodeKey => {
        selectedNodes = selectedNodes.add(this.getNode(rootKey, nodeKey));
      });
    });
    return selectedNodes;
  }

  getSingleSelectedNode(): ?FileTreeNode {
    const selectedRoots = Object.keys(this._data.selectedKeysByRoot);
    if (selectedRoots.length !== 1) {
      // There is more than one root with selected nodes. No bueno.
      return null;
    }
    const rootKey = selectedRoots[0];
    const selectedKeys = this.getSelectedKeys(rootKey);
    /*
     * Note: This does not call `getSelectedNodes` to prevent creating nodes that would be thrown
     * away if there is more than 1 selected node.
     */
    return (selectedKeys.size === 1) ? this.getNode(rootKey, selectedKeys.first()) : null;
  }

  getRootNode(rootKey: string): FileTreeNode {
    return this.getNode(rootKey, rootKey);
  }

  getNode(rootKey: string, nodeKey: string): FileTreeNode {
    return new FileTreeNode(this, rootKey, nodeKey);
  }

  isEditingWorkingSet(): boolean {
    return this._data.isEditingWorkingSet;
  }

  getEditedWorkingSet(): WorkingSet {
    return this._data.editedWorkingSet;
  }

  _setEditedWorkingSet(editedWorkingSet: WorkingSet): void {
    this._set('editedWorkingSet', editedWorkingSet);
  }

  /**
   * If a fetch is not already in progress initiate a fetch now.
   */
  _fetchChildKeys(nodeKey: string): Promise<void> {
    const existingPromise = this._getLoading(nodeKey);
    if (existingPromise) {
      return existingPromise;
    }

    const promise = FileTreeHelpers.fetchChildren(nodeKey)
      .catch(error => {
        this._logger.error(`Unable to fetch children for "${nodeKey}".`);
        this._logger.error('Original error: ', error);
        // Collapse the node and clear its loading state on error so the
        // user can retry expanding it.
        const rootKey = this.getRootForKey(nodeKey);
        if (rootKey != null) {
          this._collapseNode(rootKey, nodeKey);
        }
        this._clearLoading(nodeKey);
      })
      .then(childKeys => {
        // If this node's root went away while the Promise was resolving, do
        // no more work. This is no longer needed in the store.
        if (this.getRootForKey(nodeKey) == null) {
          return;
        }
        this._setChildKeys(nodeKey, childKeys);
        this._addSubscription(nodeKey);
        this._clearLoading(nodeKey);
      });

    this._setLoading(nodeKey, promise);
    return promise;
  }

  _getLoading(nodeKey: string): ?Promise {
    return this._data.isLoadingMap[nodeKey];
  }

  _setLoading(nodeKey: string, value: Promise): void {
    this._set('isLoadingMap', setProperty(this._data.isLoadingMap, nodeKey, value));
  }

  isCwd(nodeKey: string): boolean {
    return nodeKey === this._data.cwdKey;
  }

  hasCwd(): boolean {
    return this._data.cwdKey != null;
  }

  getFilter(): ?string {
    return this._data.filter;
  }

  addFitlerLetter(letter: ?string) {
    const filter = (this._data.filter || '') + letter;
    this._data.filter = filter;
    this._emitter.emit('change');
  }

  clearFilter(): void {
    if (this._data.filter && this._data.filter.length) {
      this._data.filter = '';
      this._emitter.emit('change');
    }
  }

  removeFilterLetter(): void {
    if (this._data.filter && this._data.filter.length) {
      this._data.filter = this._data.filter.slice(0, -1);
      this._emitter.emit('change');
    }
  }

  setFilterFound(found: boolean): void {
    if (this._data.filterFound !== found) {
      this._data.filterFound = found;
      this._emitter.emit('change');
    }
  }

  getFilterFound(): boolean {
    return this._data.filterFound || false;
  }

  _setCwdKey(rootKey: ?string): void {
    this._set('cwdKey', rootKey);
  }

  /**
   * Resets the node to be kept in view if no more data is being awaited. Safe to call many times
   * because it only changes state if a node is being tracked.
   */
  _checkTrackedNode(): void {
    if (
      this._data.trackedNode != null &&
      /*
       * The loading map being empty is a heuristic for when loading has completed. It is inexact
       * because the loading might be unrelated to the tracked node, however it is cheap and false
       * positives will only last until loading is complete or until the user clicks another node in
       * the tree.
       */
      objectUtil.isEmpty(this._data.isLoadingMap)
    ) {
      // Loading has completed. Allow scrolling to proceed as usual.
      this._set('trackedNode', null);
    }
  }

  _clearLoading(nodeKey: string): void {
    this._set('isLoadingMap', deleteProperty(this._data.isLoadingMap, nodeKey));
    this._checkTrackedNode();
  }

  async _deleteSelectedNodes(): Promise<void> {
    const selectedNodes = this.getSelectedNodes();
    await Promise.all(selectedNodes.map(async node => {
      const entry = FileTreeHelpers.getEntryByKey(node.nodeKey);

      if (entry == null) {
        return;
      }
      const path = entry.getPath();
      const repository = repositoryForPath(path);
      if (repository != null && repository.getType() === 'hg') {
        const hgRepository = ((repository: any): HgRepositoryClient);
        try {
          await hgRepository.remove(path);
        } catch (e) {
          const statuses = await hgRepository.getStatuses([path]);
          const pathStatus = statuses.get(path);
          const goodStatuses = [
            StatusCodeNumber.ADDED,
            StatusCodeNumber.CLEAN,
            StatusCodeNumber.MODIFIED,
          ];
          if (goodStatuses.indexOf(pathStatus) !== -1) {
            atom.notifications.addError(
              'Failed to remove ' + path + ' from version control.  The file will ' +
              'still get deleted but you will have to remove it from your VCS yourself.  Error: ' +
              e.toString(),
            );
          }
        }
      }
      if (FileTreeHelpers.isLocalEntry(entry)) {
        // TODO: This special-case can be eliminated once `delete()` is added to `Directory`
        // and `File`.
        shell.moveItemToTrash(node.nodePath);
      } else {
        const remoteFile = ((entry: any): (RemoteFile | RemoteDirectory));
        await remoteFile.delete();
      }
    }));
  }

  _expandNode(rootKey: string, nodeKey: string): void {
    this._setExpandedKeys(rootKey, this._getExpandedKeys(rootKey).add(nodeKey));
    // If we have child nodes that should also be expanded, expand them now.
    let previouslyExpanded = this._getPreviouslyExpanded(rootKey);
    if (previouslyExpanded.has(nodeKey)) {
      for (const childKey of previouslyExpanded.get(nodeKey)) {
        this._expandNode(rootKey, childKey);
      }
      // Clear the previouslyExpanded list since we're done with it.
      previouslyExpanded = previouslyExpanded.delete(nodeKey);
      this._setPreviouslyExpanded(rootKey, previouslyExpanded);
    }
  }

  /**
   * Performes a deep BFS scanning expand of contained nodes.
   * returns - a promise fulfilled when the expand operation is finished
   */
  _expandNodeDeep(rootKey: string, nodeKey: string): Promise<void> {
    // Stop the traversal after 100 nodes were added to the tree
    const itNodes = new FileTreeStoreBfsIterator(this, rootKey, nodeKey, /* limit*/ 100);
    const promise = new Promise(resolve => {
      const expand = () => {
        const traversedNodeKey = itNodes.traversedNode();
        if (traversedNodeKey) {
          this._setExpandedKeys(rootKey, this._getExpandedKeys(rootKey).add(traversedNodeKey));
          /**
           * Even if there were previously expanded nodes it doesn't matter as
           * we'll expand all of the children.
           */
          let previouslyExpanded = this._getPreviouslyExpanded(rootKey);
          previouslyExpanded = previouslyExpanded.delete(traversedNodeKey);
          this._setPreviouslyExpanded(rootKey, previouslyExpanded);

          const nextPromise = itNodes.next();
          if (nextPromise) {
            nextPromise.then(expand);
          }
        } else {
          resolve();
        }
      };

      expand();
    });

    return promise;
  }

  /**
   * When we collapse a node we need to do some cleanup removing subscriptions and selection.
   */
  _collapseNode(rootKey: string, nodeKey: string): void {
    const childKeys = this._data.childKeyMap[nodeKey];
    let selectedKeys = this._data.selectedKeysByRoot[rootKey];
    const expandedChildKeys = [];
    if (childKeys) {
      childKeys.forEach(childKey => {
        // Unselect each child.
        if (selectedKeys && selectedKeys.has(childKey)) {
          selectedKeys = selectedKeys.delete(childKey);
          /*
           * Set the selected keys *before* the recursive `_collapseNode` call so each call stores
           * its changes and isn't wiped out by the next call by keeping an outdated `selectedKeys`
           * in the call stack.
           */
          this._setSelectedKeys(rootKey, selectedKeys);
        }
        // Collapse each child directory.
        if (FileTreeHelpers.isDirKey(childKey)) {
          if (this.isExpanded(rootKey, childKey)) {
            expandedChildKeys.push(childKey);
            this._collapseNode(rootKey, childKey);
          }
        }
      });
    }
    /*
     * Save the list of expanded child nodes so next time we expand this node we can expand these
     * children.
     */
    let previouslyExpanded = this._getPreviouslyExpanded(rootKey);
    if (expandedChildKeys.length !== 0) {
      previouslyExpanded = previouslyExpanded.set(nodeKey, expandedChildKeys);
    } else {
      previouslyExpanded = previouslyExpanded.delete(nodeKey);
    }
    this._setPreviouslyExpanded(rootKey, previouslyExpanded);
    this._setExpandedKeys(rootKey, this._getExpandedKeys(rootKey).delete(nodeKey));
    this._removeSubscription(rootKey, nodeKey);
  }

  _getPreviouslyExpanded(rootKey: string): Immutable.Map<string, Array<string>> {
    return this._data.previouslyExpanded[rootKey] || new Immutable.Map();
  }

  _setPreviouslyExpanded(rootKey: string,
    previouslyExpanded: Immutable.Map<string, Array<string>>): void {
    this._set(
      'previouslyExpanded',
      setProperty(this._data.previouslyExpanded, rootKey, previouslyExpanded)
    );
  }

  _getExpandedKeys(rootKey: string): Immutable.Set<string> {
    return this._data.expandedKeysByRoot[rootKey] || new Immutable.Set();
  }

  /**
   * This is just exposed so it can be mocked in the tests. Not ideal, but a lot less messy than the
   * alternatives. For example, passing options when constructing an instance of a singleton would
   * make future invocations of `getInstance` unpredictable.
   */
  _repositoryForPath(path: NuclideUri): ?atom$Repository {
    return this.getRepositories().find(repo => repositoryContainsPath(repo, path));
  }

  _setExpandedKeys(rootKey: string, expandedKeys: Immutable.Set<string>): void {
    this._set(
      'expandedKeysByRoot',
      setProperty(this._data.expandedKeysByRoot, rootKey, expandedKeys)
    );
  }

  _deleteSelectedKeys(rootKey: string): void {
    this._set('selectedKeysByRoot', deleteProperty(this._data.selectedKeysByRoot, rootKey));
  }

  _setSelectedKeys(rootKey: string, selectedKeys: Immutable.OrderedSet<string>): void {
    /*
     * New selection means previous node should not be kept in view. Do this without de-bouncing
     * because the previous state is irrelevant. If the user chose a new selection, the previous one
     * should not be scrolled into view.
     */
    this._set('trackedNode', null);
    this._set(
      'selectedKeysByRoot',
      setProperty(this._data.selectedKeysByRoot, rootKey, selectedKeys)
    );
  }

  /**
   * Sets the selected keys in all roots of the tree. The selected keys of root keys not in
   * `selectedKeysByRoot` are deleted (the root is left with no selection).
   */
  _setSelectedKeysByRoot(selectedKeysByRoot: {[key: string]: Immutable.OrderedSet<string>}): void {
    this.getRootKeys().forEach(rootKey => {
      if (selectedKeysByRoot.hasOwnProperty(rootKey)) {
        this._setSelectedKeys(rootKey, selectedKeysByRoot[rootKey]);
      } else {
        this._deleteSelectedKeys(rootKey);
      }
    });
  }

  _setRootKeys(rootKeys: Array<string>): void {
    const oldRootKeys = this._data.rootKeys;
    const newRootKeys = new Immutable.Set(rootKeys);
    const removedRootKeys = new Immutable.Set(oldRootKeys).subtract(newRootKeys);
    removedRootKeys.forEach(this._purgeRoot.bind(this));
    this._set('rootKeys', rootKeys);
  }

  /**
   * Sets a single child node. It's useful when expanding to a deeply nested node.
   */
  _createChild(nodeKey: string, childKey: string): void {
    this._setChildKeys(nodeKey, [childKey]);
    /*
     * Mark the node as dirty so its ancestors are fetched again on reload of the tree.
     */
    this._set('isDirtyMap', setProperty(this._data.isDirtyMap, nodeKey, true));
  }

  _setChildKeys(nodeKey: string, childKeys: Array<string>): void {
    const oldChildKeys = this._data.childKeyMap[nodeKey];
    if (oldChildKeys) {
      const newChildKeys = new Immutable.Set(childKeys);
      const removedDirectoryKeys = new Immutable.Set(oldChildKeys)
        .subtract(newChildKeys)
        .filter(FileTreeHelpers.isDirKey);
      removedDirectoryKeys.forEach(this._purgeDirectory.bind(this));
    }
    this._set('childKeyMap', setProperty(this._data.childKeyMap, nodeKey, childKeys));
  }

  _onDirectoryChange(nodeKey: string): void {
    this._fetchChildKeys(nodeKey);
  }

  _addSubscription(nodeKey: string): void {
    const directory = FileTreeHelpers.getDirectoryByKey(nodeKey);
    if (!directory) {
      return;
    }

    /*
     * Remove the directory's dirty marker regardless of whether a subscription already exists
     * because there is nothing further making it dirty.
     */
    this._set('isDirtyMap', deleteProperty(this._data.isDirtyMap, nodeKey));

    // Don't create a new subscription if one already exists.
    if (this._data.subscriptionMap[nodeKey]) {
      return;
    }

    let subscription;
    try {
      // This call might fail if we try to watch a non-existing directory, or if permission denied.
      subscription = directory.onDidChange(() => {
        this._onDirectoryChange(nodeKey);
      });
    } catch (ex) {
      /*
       * Log error and mark the directory as dirty so the failed subscription will be attempted
       * again next time the directory is expanded.
       */
      this._logger.error(`Cannot subscribe to directory "${nodeKey}"`, ex);
      this._set('isDirtyMap', setProperty(this._data.isDirtyMap, nodeKey));
      return;
    }
    this._set('subscriptionMap', setProperty(this._data.subscriptionMap, nodeKey, subscription));
  }

  _removeSubscription(rootKey: string, nodeKey: string): void {
    let hasRemainingSubscribers;
    const subscription = this._data.subscriptionMap[nodeKey];

    if (subscription != null) {
      hasRemainingSubscribers = this._data.rootKeys.some(otherRootKey => (
        otherRootKey !== rootKey && this.isExpanded(otherRootKey, nodeKey)
      ));
      if (!hasRemainingSubscribers) {
        subscription.dispose();
        this._set('subscriptionMap', deleteProperty(this._data.subscriptionMap, nodeKey));
      }
    }

    if (subscription == null || hasRemainingSubscribers === false) {
      // Since we're no longer getting notifications when the directory contents change, assume the
      // child list is dirty.
      this._set('isDirtyMap', setProperty(this._data.isDirtyMap, nodeKey, true));
    }
  }

  _removeAllSubscriptions(nodeKey: string): void {
    const subscription = this._data.subscriptionMap[nodeKey];
    if (subscription) {
      subscription.dispose();
      this._set('subscriptionMap', deleteProperty(this._data.subscriptionMap, nodeKey));
    }
  }

  _purgeNode(rootKey: string, nodeKey: string, unselect: boolean): void {
    const expandedKeys = this._getExpandedKeys(rootKey);
    if (expandedKeys.has(nodeKey)) {
      this._setExpandedKeys(rootKey, expandedKeys.delete(nodeKey));
    }

    if (unselect) {
      const selectedKeys = this.getSelectedKeys(rootKey);
      if (selectedKeys.has(nodeKey)) {
        this._setSelectedKeys(rootKey, selectedKeys.delete(nodeKey));
      }
    }

    const previouslyExpanded = this._getPreviouslyExpanded(rootKey);
    if (previouslyExpanded.has(nodeKey)) {
      this._setPreviouslyExpanded(rootKey, previouslyExpanded.delete(nodeKey));
    }
  }

  _purgeDirectoryWithinARoot(rootKey: string, nodeKey: string, unselect: boolean): void {
    const childKeys = this._data.childKeyMap[nodeKey];
    if (childKeys) {
      childKeys.forEach(childKey => {
        if (FileTreeHelpers.isDirKey(childKey)) {
          this._purgeDirectoryWithinARoot(rootKey, childKey, /* unselect */ true);
        }
      });
    }
    this._removeSubscription(rootKey, nodeKey);
    this._purgeNode(rootKey, nodeKey, unselect);
  }

  // This is called when a dirctory is physically removed from disk. When we purge a directory,
  // we need to purge it's child directories also. Purging removes stuff from the data store
  // including list of child nodes, subscriptions, expanded directories and selected directories.
  _purgeDirectory(nodeKey: string): void {
    const childKeys = this._data.childKeyMap[nodeKey];
    if (childKeys) {
      childKeys.forEach(childKey => {
        if (FileTreeHelpers.isDirKey(childKey)) {
          this._purgeDirectory(childKey);
        }
      });
      this._set('childKeyMap', deleteProperty(this._data.childKeyMap, nodeKey));
    }

    this._removeAllSubscriptions(nodeKey);
    this.getRootKeys().forEach(rootKey => {
      this._purgeNode(rootKey, nodeKey, /* unselect */ true);
    });
  }

  // TODO: Should we clean up isLoadingMap? It contains promises which cannot be cancelled, so this
  // might be tricky.
  _purgeRoot(rootKey: string): void {
    const expandedKeys = this._data.expandedKeysByRoot[rootKey];
    if (expandedKeys) {
      expandedKeys.forEach(nodeKey => {
        this._removeSubscription(rootKey, nodeKey);
      });
      this._set('expandedKeysByRoot', deleteProperty(this._data.expandedKeysByRoot, rootKey));
    }
    this._set('selectedKeysByRoot', deleteProperty(this._data.selectedKeysByRoot, rootKey));
    // Remove all child keys so that on re-addition of this root the children will be fetched again.
    const childKeys = this._data.childKeyMap[rootKey];
    if (childKeys) {
      childKeys.forEach(childKey => {
        if (FileTreeHelpers.isDirKey(childKey)) {
          this._set('childKeyMap', deleteProperty(this._data.childKeyMap, childKey));
        }
      });
      this._set('childKeyMap', deleteProperty(this._data.childKeyMap, rootKey));
    }
    this._set('vcsStatusesByRoot', deleteProperty(this._data.vcsStatusesByRoot, rootKey));
  }

  _setTrackedNode(rootKey: string, nodeKey: string): void {
    // Flush the value to ensure clients see the value at least once and scroll appropriately.
    this._set('trackedNode', {nodeKey, rootKey}, true);
  }

  _setRepositories(repositories: Immutable.Set<atom$Repository>): void {
    this._set('repositories', repositories);

    // Whenever a new set of repositories comes in, invalidate our paths cache by resetting its
    // `cache` property (created by lodash.memoize) to an empty map.
    this._repositoryForPath.cache = new Map();
  }

  _setWorkingSet(workingSet: WorkingSet): void {
    this._set('workingSet', workingSet);
  }

  _setOpenFilesWorkingSet(openFilesWorkingSet: WorkingSet): void {
    this._set('openFilesWorkingSet', openFilesWorkingSet);
  }

  _setWorkingSetsStore(workingSetsStore: ?WorkingSetsStore): void {
    this._set('workingSetsStore', workingSetsStore);
  }

  _startEditingWorkingSet(editedWorkingSet: WorkingSet): void {
    if (!this._data.isEditingWorkingSet) {
      this._set('isEditingWorkingSet', true);
      this._setEditedWorkingSet(editedWorkingSet);
    }
  }

  _finishEditingWorkingSet(): void {
    if (this._data.isEditingWorkingSet) {
      this._set('isEditingWorkingSet', false);
      this._setEditedWorkingSet(new WorkingSet());
    }
  }

  _checkNode(rootKey: string, nodeKey: string): void {
    if (!this._data.isEditingWorkingSet) {
      return;
    }

    const editedWorkingSet = this._data.editedWorkingSet.append(nodeKey);

    const node = this.getNode(rootKey, nodeKey);
    if (node.isRoot) {
      this._setEditedWorkingSet(editedWorkingSet);
      return;
    }

    const parent = node.getParentNode();
    const childrenKeys = this.getCachedChildKeys(rootKey, parent.nodeKey);
    if (childrenKeys.every(ck => editedWorkingSet.containsFile(ck))) {
      this._checkNode(rootKey, parent.nodeKey);
    } else {
      this._setEditedWorkingSet(editedWorkingSet);
    }
  }

  _uncheckNode(rootKey: string, nodeKey: string): void {
    if (!this._data.isEditingWorkingSet) {
      return;
    }

    const node = this.getNode(rootKey, nodeKey);
    if (node.isRoot) {
      this._setEditedWorkingSet(this._data.editedWorkingSet.remove(nodeKey));
      return;
    }

    const parent = node.getParentNode();
    if (this._data.editedWorkingSet.containsFile(parent.nodeKey)) {
      this._uncheckNode(rootKey, parent.nodeKey);
      const childrenKeys = this.getCachedChildKeys(rootKey, parent.nodeKey);
      const siblingsKeys = childrenKeys.filter(ck => ck !== nodeKey);

      this._setEditedWorkingSet(this._data.editedWorkingSet.append(...siblingsKeys));
    } else {
      this._setEditedWorkingSet(this._data.editedWorkingSet.remove(nodeKey));
    }
  }

  _omitHiddenPaths(nodeKeys: Array<string>): Array<string> {
    if (
      !this._data.hideIgnoredNames &&
      !this._data.excludeVcsIgnoredPaths &&
      this._data.workingSet.isEmpty()
    ) {
      return nodeKeys;
    }

    return nodeKeys.filter(nodeKey => !this._shouldHidePath(nodeKey));
  }

  _shouldHidePath(nodeKey: string): boolean {
    const isIgnoredPath = this._isIgnoredPath(nodeKey);
    if (isIgnoredPath) {
      return true;
    }

    const isExcludedFromWs = this._isExcludedFromWorkingSet(nodeKey);
    return isExcludedFromWs && this._isExcludedFromOpenFilesWorkingSet(nodeKey);
  }

  _isIgnoredPath(nodeKey: string): boolean {
    const {hideIgnoredNames, excludeVcsIgnoredPaths, ignoredPatterns} = this._data;

    if (hideIgnoredNames && matchesSome(nodeKey, ignoredPatterns)) {
      return true;
    }
    if (excludeVcsIgnoredPaths && isVcsIgnored(nodeKey, this._repositoryForPath(nodeKey))) {
      return true;
    }

    return false;
  }

  _isExcludedFromWorkingSet(nodeKey: string): boolean {
    const {workingSet, isEditingWorkingSet} = this._data;

    if (!isEditingWorkingSet) {
      if (FileTreeHelpers.isDirKey(nodeKey)) {
        return !workingSet.containsDir(nodeKey);
      } else {
        return !workingSet.containsFile(nodeKey);
      }
    }

    return false;
  }

  _isExcludedFromOpenFilesWorkingSet(nodeKey: string): boolean {
    const {openFilesWorkingSet, isEditingWorkingSet} = this._data;

    if (isEditingWorkingSet) {
      return false;
    }

    if (openFilesWorkingSet.isEmpty()) {
      return true;
    }

    if (FileTreeHelpers.isDirKey(nodeKey)) {
      return !openFilesWorkingSet.containsDir(nodeKey);
    } else {
      return !openFilesWorkingSet.containsFile(nodeKey);
    }
  }

  reset(): void {
    const subscriptionMap = this._data.subscriptionMap;
    for (const nodeKey of Object.keys(subscriptionMap)) {
      const subscription = subscriptionMap[nodeKey];
      if (subscription) {
        subscription.dispose();
      }
    }

    // Reset data store.
    this._data = this._getDefaults();
  }

  subscribe(listener: ChangeListener): IDisposable {
    return this._emitter.on('change', listener);
  }
}

// A helper to delete a property in an object using shallow copy rather than mutation
function deleteProperty(object: Object, key: string): Object {
  if (!object.hasOwnProperty(key)) {
    return object;
  }
  const newObject = {...object};
  delete newObject[key];
  return newObject;
}

// A helper to set a property in an object using shallow copy rather than mutation
function setProperty(object: Object, key: string, newValue: mixed): Object {
  const oldValue = object[key];
  if (oldValue === newValue) {
    return object;
  }
  const newObject = {...object};
  newObject[key] = newValue;
  return newObject;
}

// Create a new object by mapping over the properties of a given object, calling the given
// function on each one.
function mapValues(object: Object, fn: Function): Object {
  const newObject = {};
  Object.keys(object).forEach(key => {
    newObject[key] = fn(object[key], key);
  });
  return newObject;
}

// Determine whether the given string matches any of a set of patterns.
function matchesSome(str: string, patterns: Immutable.Set<Minimatch>) {
  return patterns.some(pattern => pattern.match(str));
}

function isVcsIgnored(nodeKey: string, repo: ?atom$Repository) {
  return repo && repo.isProjectAtRoot() && repo.isPathIgnored(nodeKey);
}


/**
 * Performs a breadth-first iteration over the directories of the tree starting
 * with a given node. The iteration stops once a given limit of nodes (both directories
 * and files) were traversed.
 * The node being currently traversed can be obtained by calling .traversedNode()
 * .next() returns a promise that is fulfilled when the traversal moves on to
 * the next directory.
 */
class FileTreeStoreBfsIterator {
  _fileTreeStore: FileTreeStore;
  _rootKey: string;
  _nodesToTraverse: Array<string>;
  _currentlyTraversedNode: ?string;
  _limit: number;
  _numNodesTraversed: number;
  _promise: ?Promise<void>;
  _count: number;

  constructor(
      fileTreeStore: FileTreeStore,
      rootKey: string,
      nodeKey: string,
      limit: number) {
    this._fileTreeStore = fileTreeStore;
    this._rootKey = rootKey;
    this._nodesToTraverse = [];
    this._currentlyTraversedNode = nodeKey;
    this._limit = limit;
    this._numNodesTraversed = 0;
    this._promise = null;
    this._count = 0;
  }

  _handlePromiseResolution(childrenKeys: Array<string>): void {
    this._numNodesTraversed += childrenKeys.length;
    if (this._numNodesTraversed < this._limit) {
      const nextLevelNodes = childrenKeys.filter(childKey => FileTreeHelpers.isDirKey(childKey));
      this._nodesToTraverse = this._nodesToTraverse.concat(nextLevelNodes);

      this._currentlyTraversedNode = this._nodesToTraverse.splice(0, 1)[0];
      this._promise = null;
    } else {
      this._currentlyTraversedNode = null;
      this._promise = null;
    }

    return;
  }

  next(): ?Promise<void> {
    const currentlyTraversedNode = this._currentlyTraversedNode;
    if (!this._promise && currentlyTraversedNode) {
      this._promise = this._fileTreeStore.promiseNodeChildKeys(
        this._rootKey,
        currentlyTraversedNode)
      .then(this._handlePromiseResolution.bind(this));
    }
    return this._promise;
  }

  traversedNode(): ?string {
    return this._currentlyTraversedNode;
  }
}

module.exports = FileTreeStore;
