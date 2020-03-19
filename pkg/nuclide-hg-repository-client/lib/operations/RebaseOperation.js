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

import type {
  HgOperation,
  TreePreviewApplierFunction,
  ReportedOptimisticState,
} from '../HgOperation';
import type {RevisionTree} from '../revisionTree/RevisionTree';
import {ButtonTypes} from 'nuclide-commons-ui/Button';
import {
  RevisionPreviews,
  getRevisionTreeMapFromTree,
  getHeadTree,
} from '../revisionTree/RevisionTree';

import {Observable} from 'rxjs';

export class HgRebaseOperation implements HgOperation {
  _source: ?string; // null for .
  _destination: string;

  constructor(source: ?string, destination: string) {
    this._source = source;
    this._destination = destination;
  }

  name = 'hide';

  getArgs() {
    const args = ['rebase'];
    if (this._source != null) {
      args.push('-s', this._source);
    }
    args.push('-d', this._destination);
    return args;
  }

  getEquivalentCommand() {
    return this.getArgs().join(' ');
  }

  getCommandDocumentation() {
    return {
      naturalLanguageDescription: 'Moves the commit to a different branch',
      confirmationButtonType: ButtonTypes.PRIMARY,
      confirmationButtonText: 'Run rebase',
      confirmationMessage: 'Are you sure you want to run this rebase?',
    };
  }

  makePreviewApplier(
    baseTree: Array<RevisionTree>,
  ): ?TreePreviewApplierFunction {
    let source = this._source;
    if (source == null) {
      const head = getHeadTree(baseTree);
      if (head == null) {
        return null;
      }
      source = head.info.hash;
    }
    const treeMap = getRevisionTreeMapFromTree(baseTree);
    const originalSourceNode = treeMap.get(source);
    if (originalSourceNode == null) {
      return null;
    }
    const newSourceNode = {
      ...originalSourceNode,
      info: {...originalSourceNode.info},
    };
    newSourceNode.info.parents = [this._destination];

    const func: TreePreviewApplierFunction = (tree, nodePreviewType) => {
      if (tree.info.hash === source) {
        if (tree === newSourceNode) {
          // this is the newly added node
          return [tree.children, RevisionPreviews.REBASE_ROOT];
        } else {
          // this is the original source node
          return [tree.children, RevisionPreviews.REBASE_OLD];
        }
      }
      if (tree.info.hash === this._destination) {
        // we always want the rebase preview to be the lowest child aka last in list
        return [[...tree.children, newSourceNode], null];
      }

      return [tree.children, nodePreviewType];
    };
    return func;
  }

  makeOptimisticStateApplier(
    treeObservable: Observable<Array<RevisionTree>>,
  ): Observable<?ReportedOptimisticState> {
    return treeObservable
      .takeWhile(trees => {
        let source = this._source;
        if (source == null) {
          const head = getHeadTree(trees);
          if (head == null) {
            return false;
          }
          source = head.info.hash;
        }
        const treeMap = getRevisionTreeMapFromTree(trees);

        // only apply optimistic state while the original commit is visible
        return treeMap.get(source) != null;
      })
      .switchMap(trees => {
        let source = this._source;
        if (source == null) {
          const head = getHeadTree(trees);
          if (head == null) {
            return Observable.of(null);
          }
          source = head.info.hash;
        }

        const treeMap = getRevisionTreeMapFromTree(trees);
        const originalSourceNode = treeMap.get(source);
        if (originalSourceNode == null) {
          return Observable.of(null);
        }

        const newSourceNode = {
          ...originalSourceNode,
          info: {...originalSourceNode.info},
        };
        newSourceNode.info.parents = [this._destination];

        const optimisticApplier: TreePreviewApplierFunction = (
          tree,
          nodePreviewType,
        ) => {
          if (tree.info.hash === source) {
            if (tree === newSourceNode) {
              // this is the newly added node
              return [tree.children, RevisionPreviews.OPTIMISTIC_REBASE_ROOT];
            } else {
              // this is the original source node, don't show it in the optimistic verison
              return [[], RevisionPreviews.HIDDEN];
            }
          }
          // TODO: support destination being a bookmark
          if (tree.info.hash === this._destination) {
            // optimstic rebase result is now first in the list
            return [[newSourceNode, ...tree.children], null];
          }

          return [tree.children, nodePreviewType];
        };

        return Observable.of({
          optimisticApplier,
        });
      });
  }
}
