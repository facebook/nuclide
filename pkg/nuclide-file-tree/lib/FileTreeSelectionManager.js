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

import type {FileTreeNode} from './FileTreeNode';

import Immutable from 'immutable';

export class FileTreeSelectionManager {
  _selectedNodes: Immutable.Set<FileTreeNode>;
  _focusedNodes: Immutable.Set<FileTreeNode>;
  _emitChange: () => mixed;

  constructor(emitChange: () => mixed) {
    this._emitChange = emitChange;
    this._selectedNodes = new Immutable.Set();
    this._focusedNodes = new Immutable.Set();
  }

  selectedNodes(): Immutable.Set<FileTreeNode> {
    return this._selectedNodes;
  }

  focusedNodes(): Immutable.Set<FileTreeNode> {
    return this._focusedNodes;
  }

  isSelected(node: FileTreeNode): boolean {
    return this._selectedNodes.has(node);
  }

  isFocused(node: FileTreeNode): boolean {
    return this._focusedNodes.has(node);
  }

  _checkSelected(newSelected: Immutable.Set<FileTreeNode>): void {
    if (newSelected !== this._selectedNodes) {
      this._selectedNodes = newSelected;
      this._emitChange();
    }
  }

  _checkFocused(newFocused: Immutable.Set<FileTreeNode>): void {
    if (newFocused !== this._focusedNodes) {
      this._focusedNodes = newFocused;
      this._emitChange();
    }
  }

  select(node: FileTreeNode): void {
    this._checkSelected(this._selectedNodes.add(node));
  }

  unselect(node: FileTreeNode): void {
    this._checkSelected(this._selectedNodes.delete(node));
  }

  focus(node: FileTreeNode): void {
    this._checkFocused(this._focusedNodes.add(node));
  }

  unfocus(node: FileTreeNode): void {
    this._checkFocused(this._focusedNodes.delete(node));
  }

  clearSelected(): void {
    this._checkSelected(this._selectedNodes.clear());
  }

  clearFocused(): void {
    this._checkFocused(this._focusedNodes.clear());
  }

  collectDebugState(): Object {
    return {
      _selectedNodes: this._selectedNodes.toArray().map(node => node.uri),
      _focusedNodes: this._focusedNodes.toArray().map(node => node.uri),
    };
  }
}
