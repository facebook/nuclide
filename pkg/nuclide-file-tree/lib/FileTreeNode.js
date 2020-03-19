/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import nuclideUri from 'nuclide-commons/nuclideUri';
import * as Immutable from 'immutable';
import * as FileTreeHelpers from './FileTreeHelpers';

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {NodeCheckedStatus} from './types';
import type {GeneratedFileType} from '../../nuclide-generated-files-rpc/lib/GeneratedFileService';

export type FileTreeNodeOptions = {|
  uri: NuclideUri,
  rootUri: NuclideUri,
  name?: string,
  relativePath?: string,
  localPath?: string,
  isExpanded?: boolean,
  isDragHovered?: boolean,
  isBeingReordered?: boolean,
  isLoading?: boolean,
  wasFetched?: boolean,
  isCwd?: boolean,
  children?: Immutable.OrderedMap<string, FileTreeNode>,
  connectionTitle?: string,
  checkedStatus?: NodeCheckedStatus,
  subscription?: ?IDisposable,
  highlightedText?: string,
  matchesFilter?: boolean,
  isPendingLoad?: boolean,
  generatedStatus?: ?GeneratedFileType,
|};

type DefaultFileTreeNodeOptions = {
  isExpanded: boolean,
  isDragHovered: boolean,
  isBeingReordered: boolean,
  isLoading: boolean,
  wasFetched: boolean,
  isCwd: boolean,
  children: Immutable.OrderedMap<string, FileTreeNode>,
  connectionTitle: string,
  subscription: ?IDisposable,
  highlightedText: string,
  matchesFilter: boolean,
  isPendingLoad: boolean,
  generatedStatus: ?GeneratedFileType,
};

const DEFAULT_OPTIONS: DefaultFileTreeNodeOptions = {
  isExpanded: false,
  isDragHovered: false,
  isBeingReordered: false,
  isLoading: false,
  wasFetched: false,
  isCwd: false,
  children: Immutable.OrderedMap(),
  connectionTitle: '',
  subscription: null,
  highlightedText: '',
  matchesFilter: true,
  isPendingLoad: false,
  generatedStatus: null,
};

export type ImmutableNodeSettableFields = {
  isExpanded?: boolean,
  isDragHovered?: boolean,
  isBeingReordered?: boolean,
  isLoading?: boolean,
  wasFetched?: boolean,
  isCwd?: boolean,
  children?: Immutable.OrderedMap<string, FileTreeNode>,
  subscription?: ?IDisposable,
  highlightedText?: string,
  matchesFilter?: boolean,
  isPendingLoad?: boolean,
  generatedStatus?: ?GeneratedFileType,
};

/**
 * OVERVIEW
 *   The FileTreeNode class is almost entirely immutable. Except for the parent and the sibling
 * links no properties are to be updated after the creation.
 *
 *   Setting any of the properties (except for the aforementioned links to parent and siblings) will
 * create a new instance of the class, with required properties set. If, however, the set operation
 * is a no-op (such if setting a property to the same value it already has), new instance creation
 * is not skipped and same instance is returned instead.
 *
 * CHILDREN HANDLING
 *   In order for the tree traversal and modifications to be efficient one often
 * needs to find the parent of a node. Parent property, however, can't be one of the node's immutable
 * fields, otherwise it'd create circular references. Therefore the parent property is never given
 * to the node's constructor, but rather set by the parent itself when the node is assigned to it.
 * This means that we must avoid the state when same node node is contained in the .children map
 * of several other nodes. As only the latest one it was assigned to is considered its parent from
 * the node's perspective.
 *
 *   Just like the parent property, some operations require an ability to find siblings easily.
 * The previous and the next sibling properties are too set when a child is assigned to its parent.
 *
 *   Some of the properties are derived from the properties of children. For example, it is
 * beneficial to know whether a node contains a selected node in its sub-tree and the size of the
 * visible sub-tree.
 *
 *   All property derivation and links set-up is done with one traversal only over the children.
 */
export class FileTreeNode {
  // Mutable properties - set when the node is assigned to its parent (and are immutable after)
  parent: ?FileTreeNode;
  nextSibling: ?FileTreeNode;
  prevSibling: ?FileTreeNode;

  uri: NuclideUri;
  rootUri: NuclideUri;
  name: string;
  isRoot: boolean;
  isExpanded: boolean;
  isDragHovered: boolean;
  isBeingReordered: boolean;
  isLoading: boolean;
  wasFetched: boolean;
  isCwd: boolean;
  children: Immutable.OrderedMap<string, FileTreeNode>;
  connectionTitle: string;
  subscription: ?IDisposable;
  highlightedText: string;
  matchesFilter: boolean;
  isPendingLoad: boolean;
  generatedStatus: ?GeneratedFileType;
  relativePath: string;
  localPath: string;

  /**
   * The children property is an OrderedMap instance keyed by child's name property.
   * This convenience function would create such OrderedMap instance from a plain JS Array
   * of FileTreeNode instances
   */
  static childrenFromArray(
    children: Array<FileTreeNode>,
  ): Immutable.OrderedMap<string, FileTreeNode> {
    return Immutable.OrderedMap(children.map(child => [child.name, child]));
  }

  constructor(options: FileTreeNodeOptions) {
    this.parent = null;
    this.nextSibling = null;
    this.prevSibling = null;
    this._assignOptions(options);
    this._handleChildren();
  }

  /**
   * Sets the links from the children to this instance (their parent) and the links between the
   * siblings.
   */
  _handleChildren(): void {
    let prevChild = null;
    this.children.forEach(c => {
      c.parent = this;

      c.prevSibling = prevChild;
      if (prevChild != null) {
        prevChild.nextSibling = c;
      }
      prevChild = c;
    });
    if (prevChild != null) {
      prevChild.nextSibling = null;
    }
  }

  /**
   * Using object.assign() was proven to be less performant than direct named assignment
   * Since in heavy updates, nodes are created by the thousands we need to keep the creation
   * flow performant.
   */
  _assignOptions(options: FileTreeNodeOptions): void {
    this.uri = options.uri;
    this.rootUri = options.rootUri;
    this.name = options.name ?? FileTreeHelpers.keyToName(this.uri);
    this.isRoot = this.uri === this.rootUri;
    this.relativePath =
      options.relativePath ?? nuclideUri.relative(this.rootUri, this.uri);
    this.localPath =
      options.localPath ??
      FileTreeHelpers.keyToPath(
        nuclideUri.isRemote(this.uri)
          ? nuclideUri.parse(this.uri).path
          : this.uri,
      );
    this.isExpanded =
      options.isExpanded !== undefined
        ? options.isExpanded
        : DEFAULT_OPTIONS.isExpanded;
    this.isDragHovered =
      options.isDragHovered !== undefined
        ? options.isDragHovered
        : DEFAULT_OPTIONS.isDragHovered;
    this.isBeingReordered =
      options.isBeingReordered !== undefined
        ? options.isBeingReordered
        : DEFAULT_OPTIONS.isBeingReordered;
    this.isLoading =
      options.isLoading !== undefined
        ? options.isLoading
        : DEFAULT_OPTIONS.isLoading;
    this.wasFetched =
      options.wasFetched !== undefined
        ? options.wasFetched
        : DEFAULT_OPTIONS.wasFetched;
    this.isCwd =
      options.isCwd !== undefined ? options.isCwd : DEFAULT_OPTIONS.isCwd;
    this.children =
      options.children !== undefined
        ? options.children
        : DEFAULT_OPTIONS.children;
    this.connectionTitle =
      options.connectionTitle !== undefined
        ? options.connectionTitle
        : DEFAULT_OPTIONS.connectionTitle;
    this.subscription =
      options.subscription !== undefined
        ? options.subscription
        : DEFAULT_OPTIONS.subscription;
    this.highlightedText =
      options.highlightedText !== undefined
        ? options.highlightedText
        : DEFAULT_OPTIONS.highlightedText;
    this.matchesFilter =
      options.matchesFilter !== undefined
        ? options.matchesFilter
        : DEFAULT_OPTIONS.matchesFilter;
    this.generatedStatus =
      options.generatedStatus !== undefined
        ? options.generatedStatus
        : DEFAULT_OPTIONS.generatedStatus;

    // `isPendingLoad` is a special case in that it's sticky. Once a node's not pending load, it can
    // never be pending load again. When you move from loading -> not loading, a load is no longer
    // pending.
    if (!this.isLoading) {
      this.isPendingLoad = false;
    } else if (this.isPendingLoad !== false) {
      this.isPendingLoad =
        options.isPendingLoad ?? DEFAULT_OPTIONS.isPendingLoad;
    }
  }

  /**
   * When modifying some of the properties a new instance needs to be created with all of the
   * properties identical except for those being modified. This method creates the baseline options
   * instance
   */
  _buildOptions(): FileTreeNodeOptions {
    return {
      uri: this.uri,
      rootUri: this.rootUri,
      name: this.name,
      relativePath: this.relativePath,
      localPath: this.localPath,
      isExpanded: this.isExpanded,
      isDragHovered: this.isDragHovered,
      isBeingReordered: this.isBeingReordered,
      isLoading: this.isLoading,
      wasFetched: this.wasFetched,
      isCwd: this.isCwd,
      children: this.children,
      connectionTitle: this.connectionTitle,
      subscription: this.subscription,
      highlightedText: this.highlightedText,
      matchesFilter: this.matchesFilter,
      isPendingLoad: this.isPendingLoad,
      generatedStatus: this.generatedStatus,
    };
  }

  setIsExpanded(isExpanded: boolean): FileTreeNode {
    return this.set({isExpanded});
  }

  setIsDragHovered(isDragHovered: boolean): FileTreeNode {
    return this.set({isDragHovered});
  }

  setIsLoading(isLoading: boolean): FileTreeNode {
    return this.set({isLoading});
  }

  setIsCwd(isCwd: boolean): FileTreeNode {
    return this.set({isCwd});
  }

  setChildren(
    children: Immutable.OrderedMap<string, FileTreeNode>,
  ): FileTreeNode {
    return this.set({children});
  }

  setGeneratedStatus(generatedStatus: GeneratedFileType): FileTreeNode {
    return this.set({generatedStatus});
  }

  /**
   * Used to modify several properties at once and skip unnecessary construction of intermediate
   * instances. For example:
   * const newNode = node.set({isExpanded: true});
   */
  set(props: ImmutableNodeSettableFields): FileTreeNode {
    return this._propsAreTheSame(props) ? this : this._newNode(props);
  }

  /**
   * Performs an update of a tree branch. Receives two optional predicates
   *
   * The `prePredicate` is invoked at pre-descent. If the predicate returns a non-null
   * value it signifies that the handling of the sub-branch is complete and the descent to children
   * is not performed.
   *
   * The `postPredicate` is invoked on the way up. It has to return a non-null node, but it may
   * be the same instance as it was called with.
   */
  setRecursive(
    prePredicate: ?(node: FileTreeNode) => ?FileTreeNode,
    postPredicate: (node: FileTreeNode) => FileTreeNode = n => n,
  ): FileTreeNode {
    if (prePredicate != null) {
      const newNode = prePredicate(this);
      if (newNode != null) {
        return postPredicate(newNode);
      }
    }

    const children = this.children.map(child =>
      child.setRecursive(prePredicate, postPredicate),
    );

    return postPredicate(this.setChildren(children));
  }

  /**
   * Updates a single child in the map of children. The method only receives the new child instance
   * and the retrieval in from the map is performed by the child's name. This uses the fact
   * that children names (derived from their uris) are unmodifiable. Thus we won't ever have a
   * problem locating the value that we need to replace.
   */
  updateChild(newChild: FileTreeNode): FileTreeNode {
    const children = this.children.set(newChild.name, newChild);
    return this.set({children});
  }

  /**
   * A hierarchical equivalent of forEach. The method receives two predicates
   * The first is invoked upon descent and with its return value controls whether need to traverse
   * deeper into the tree. True - descend, False - don't.
   */
  traverse(
    preCallback: (node: FileTreeNode) => boolean,
    postCallback: (node: FileTreeNode) => void = () => {},
  ): void {
    const descend = preCallback(this);

    if (descend) {
      this.children.forEach(child => child.traverse(preCallback, postCallback));
    }

    postCallback(this);
  }

  /**
   * Looks for a node with the given URI in the sub branch - returns null if not found
   */
  find(uri: NuclideUri): ?FileTreeNode {
    const deepestFound = this.findDeepest(uri);

    if (deepestFound == null || deepestFound.uri !== uri) {
      return null;
    }

    return deepestFound;
  }

  /**
   * Looks for a node with the given URI in the sub branch - returns the deepest found ancesstor
   * of the node being looked for.
   * Returns null if the node can not belong to the sub-branch
   */
  findDeepest(uri: NuclideUri): ?FileTreeNode {
    if (!uri.startsWith(this.uri)) {
      return null;
    }

    if (uri === this.uri) {
      return this;
    }

    const childNamePath = nuclideUri.split(nuclideUri.relative(this.uri, uri));
    return this._findLastByNamePath(childNamePath);
  }

  getDepth(): number {
    let it = this.parent;
    let depth = 0;
    while (it != null) {
      it = it.parent;
      depth++;
    }

    return depth;
  }

  _propsAreTheSame(props: ImmutableNodeSettableFields): boolean {
    if (
      props.isDragHovered !== undefined &&
      this.isDragHovered !== props.isDragHovered
    ) {
      return false;
    }
    if (
      props.isBeingReordered !== undefined &&
      this.isBeingReordered !== props.isBeingReordered
    ) {
      return false;
    }
    if (
      props.isExpanded !== undefined &&
      this.isExpanded !== props.isExpanded
    ) {
      return false;
    }
    if (props.isLoading !== undefined && this.isLoading !== props.isLoading) {
      return false;
    }
    if (
      props.wasFetched !== undefined &&
      this.wasFetched !== props.wasFetched
    ) {
      return false;
    }
    if (props.isCwd !== undefined && this.isCwd !== props.isCwd) {
      return false;
    }
    if (
      props.subscription !== undefined &&
      this.subscription !== props.subscription
    ) {
      return false;
    }
    if (
      props.highlightedText !== undefined &&
      this.highlightedText !== props.highlightedText
    ) {
      return false;
    }
    if (
      props.matchesFilter !== undefined &&
      this.matchesFilter !== props.matchesFilter
    ) {
      return false;
    }

    if (
      props.children !== undefined &&
      props.children !== this.children &&
      !Immutable.is(this.children, props.children)
    ) {
      return false;
    }

    if (
      props.isPendingLoad !== undefined &&
      props.isPendingLoad !== this.isPendingLoad
    ) {
      return false;
    }

    if (
      props.generatedStatus !== undefined &&
      props.generatedStatus !== this.generatedStatus
    ) {
      return false;
    }

    return true;
  }

  _newNode(props: ImmutableNodeSettableFields): FileTreeNode {
    const options = this._buildOptions();
    return new FileTreeNode({
      ...options,
      ...props,
    });
  }

  _findLastByNamePath(childNamePath: Array<string>): FileTreeNode {
    if (childNamePath.length === 0) {
      return this;
    }

    const child = this.children.get(childNamePath[0]);
    if (child == null) {
      return this;
    }

    return child._findLastByNamePath(childNamePath.slice(1));
  }
}
