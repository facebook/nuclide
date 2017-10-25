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

import {arrayEqual} from 'nuclide-commons/collection';
import {dedupeUris} from './uri';
import invariant from 'assert';
import {getLogger} from 'log4js';
import nuclideUri from 'nuclide-commons/nuclideUri';
const logger = getLogger('nuclide-working-sets-common');

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

type InnerNode = {
  kind: 'inner',
  children: Map<string, TreeNode>,
};

type LeafNode = {
  kind: 'leaf',
};

type TreeNode = InnerNode | LeafNode;

/**
* WorkingSet is an implementation of a filter for files and directories.
* - It is *immutable*
* - It is created from a set of NuclideUris.
*     A path URI is either a local path, such as: /aaa/bb/ccc
*     or remote nuclide://sandbox.com/aaa/bb/ccc
* - The URIs can point either to files or to directories.
* - Empty WorkingSet is essentially an empty filter - it accepts everything.
* - Non-empty WorkingSet contains every file specified by the contained URIs or below.
*   So, if a URI points to a directory - all its sub-directories and files in them are included.
*   This kind of test is performed by the .containsFile() method.
* - WorkingSet aims to support queries for the hierarchical structures, such as TreeView.
*   Therefore, if a file is included in the WorkingSet, then the file-tree must have a way
*   to know that it must include its parent directories.
*   This kind of test is performed by the .containsDir() method.
*/
export class WorkingSet {
  _uris: Array<string>;
  _root: ?InnerNode;

  constructor(uris: Array<NuclideUri> = []) {
    try {
      this._uris = dedupeUris(
        uris.filter(uri => !nuclideUri.isBrokenDeserializedUri(uri)),
      );
      this._root = this._buildDirTree(this._uris);
    } catch (e) {
      logger.error(
        'Failed to initialize a WorkingSet with URIs ' +
          uris.join(',') +
          '. ' +
          e.message,
      );
      this._uris = [];
      this._root = null;
    }
  }

  containsFile(uri: NuclideUri): boolean {
    if (this.isEmpty()) {
      return true;
    }

    try {
      return this.containsFileBySplitPath(nuclideUri.split(uri));
    } catch (e) {
      logger.error(e);
      return true;
    }
  }

  containsFileBySplitPath(tokens: Array<string>): boolean {
    if (this.isEmpty()) {
      return true;
    }

    return this._containsPathFor(tokens, /* mustHaveLeaf */ true);
  }

  containsDir(uri: NuclideUri): boolean {
    if (this.isEmpty()) {
      return true;
    }

    try {
      return this.containsDirBySplitPath(nuclideUri.split(uri));
    } catch (e) {
      logger.error(e);
      return true;
    }
  }

  containsDirBySplitPath(tokens: Array<string>): boolean {
    if (this.isEmpty()) {
      return true;
    }

    return this._containsPathFor(tokens, /* mustHaveLeaf */ false);
  }

  isEmpty(): boolean {
    return this._uris.length === 0;
  }

  getUris(): Array<string> {
    return this._uris;
  }

  append(...uris: Array<NuclideUri>): WorkingSet {
    return new WorkingSet(this._uris.concat(uris));
  }

  remove(rootUri: NuclideUri): WorkingSet {
    try {
      const uris = this._uris.filter(uri => !nuclideUri.contains(rootUri, uri));
      return new WorkingSet(uris);
    } catch (e) {
      logger.error(e);
      return this;
    }
  }

  equals(other: WorkingSet): boolean {
    return arrayEqual(this._uris, other._uris);
  }

  _buildDirTree(uris: Array<string>): ?InnerNode {
    if (uris.length === 0) {
      return null;
    }

    const root: InnerNode = newInnerNode();

    for (const uri of uris) {
      const tokens = nuclideUri.split(uri);
      if (tokens.length === 0) {
        continue;
      }

      let currentNode: InnerNode = root;

      for (const token of tokens.slice(0, -1)) {
        let tokenNode: ?TreeNode = currentNode.children.get(token);

        if (!tokenNode) {
          tokenNode = newInnerNode();
          currentNode.children.set(token, tokenNode);
          currentNode = tokenNode;
        } else {
          invariant(tokenNode.kind === 'inner');
          currentNode = tokenNode;
        }
      }

      const lastToken = tokens[tokens.length - 1];
      currentNode.children.set(lastToken, newLeafNode());
    }

    return root;
  }

  _containsPathFor(tokens: Array<string>, mustHaveLeaf: boolean): boolean {
    let currentNode = this._root;
    if (currentNode == null) {
      // Empty set actually contains everything
      return true;
    }

    for (const token of tokens) {
      const tokenNode = currentNode.children.get(token);
      if (tokenNode == null) {
        return false;
      } else if (tokenNode.kind === 'leaf') {
        return true;
      } else if (tokenNode.kind === 'inner') {
        currentNode = tokenNode;
      }
    }

    return !mustHaveLeaf;
  }
}

function newInnerNode(): InnerNode {
  return {kind: 'inner', children: new Map()};
}

function newLeafNode(): LeafNode {
  return {kind: 'leaf'};
}
