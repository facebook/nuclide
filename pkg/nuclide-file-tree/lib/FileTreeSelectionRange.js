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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import {FileTreeNode} from './FileTreeNode';

export class RangeKey {
  _rootKey: NuclideUri;
  _nodeKey: NuclideUri;
  constructor(rootKey: NuclideUri, nodeKey: NuclideUri) {
    this._rootKey = rootKey;
    this._nodeKey = nodeKey;
  }
  static of(node: FileTreeNode): RangeKey {
    return new RangeKey(node.rootUri, node.uri);
  }
  rootKey(): NuclideUri {
    return this._rootKey;
  }
  nodeKey(): NuclideUri {
    return this._nodeKey;
  }
  equals(other: RangeKey): boolean {
    return this._rootKey === other._rootKey && this._nodeKey === other._nodeKey;
  }
}

export class SelectionRange {
  _anchor: RangeKey;
  _range: RangeKey;
  constructor(anchor: RangeKey, range: RangeKey) {
    this._anchor = anchor;
    this._range = range;
  }
  anchor(): RangeKey {
    return this._anchor;
  }
  range(): RangeKey {
    return this._range;
  }
  static ofSingleItem(anchor: RangeKey): SelectionRange {
    return new SelectionRange(anchor, anchor);
  }
  withNewRange(range: RangeKey): SelectionRange {
    return new SelectionRange(this._anchor, range);
  }
  withNewAnchor(anchor: RangeKey): SelectionRange {
    return new SelectionRange(anchor, this._range);
  }
  equals(other: SelectionRange): boolean {
    return (
      this._anchor.equals(other._anchor) && this._range.equals(other._range)
    );
  }
}

/**
 * Returns the current node if it is shown.
 * Otherwise, returns a nearby node that is shown.
 */
function findShownNode(node: FileTreeNode): ?FileTreeNode {
  if (node.shouldBeShown) {
    return node;
  }

  let shown = node;
  while (shown != null) {
    const next = shown.findNextShownSibling();
    if (next != null) {
      return next;
    }
    shown = shown.parent;
  }

  shown = node;
  while (shown != null) {
    const next = shown.findPrevShownSibling();
    if (next != null) {
      return next;
    }
    shown = shown.parent;
  }
  return null;
}

export class RangeUtil {
  /**
   * Returns the current node if it is shown and selected
   * Otherwise, returns a nearby selected node.
   */
  static findSelectedNode(node: FileTreeNode): ?FileTreeNode {
    const shown = findShownNode(node);
    if (shown == null) {
      return shown;
    }
    if (shown.isSelected()) {
      return shown;
    }
    let selected = shown;
    while (selected != null && !selected.isSelected()) {
      selected = selected.findNext();
    }
    if (selected != null) {
      return selected;
    }
    selected = shown;
    while (selected != null && !selected.isSelected()) {
      selected = selected.findPrevious();
    }
    return selected;
  }
}
