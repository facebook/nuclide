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
import {RangeKey, SelectionRange} from '../lib/FileTreeSelectionRange';

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import {FileTreeNode} from '../lib/FileTreeNode';
import tempModule from 'temp';

tempModule.track();

describe('FileTreeSelectionRange', () => {
  function createNode(rootUri: NuclideUri, uri: NuclideUri): FileTreeNode {
    return new FileTreeNode({rootUri, uri});
  }

  describe('RangeKey', () => {
    it('properly construct the object', () => {
      const key = new RangeKey('a', 'b');
      expect(key.rootKey() === 'a').toBe(true);
      expect(key.nodeKey() === 'b').toBe(true);
    });

    it('properly construct with factory method', () => {
      const node = createNode('a', 'b');
      const key = RangeKey.of(node);
      expect(key.rootKey() === 'a').toBe(true);
      expect(key.nodeKey() === 'b').toBe(true);
    });

    it('properly test equality', () => {
      const key1 = new RangeKey('a', 'b');
      const key2 = new RangeKey('a', 'b');
      expect(key1 === key2).toBe(false);
      expect(key1).toEqual(key2);
      expect(key1.equals(key2)).toBe(true);
    });
  });

  describe('SelectionRange', () => {
    const key1 = new RangeKey('a', '1');
    const key2 = new RangeKey('a', '2');
    const key3 = new RangeKey('a', '3');

    it('properly construct the object', () => {
      const range = new SelectionRange(key1, key2);
      expect(range.anchor().equals(key1)).toBe(true);
      expect(range.range().equals(key2)).toBe(true);
    });

    describe('factory method', () => {
      it('properly construct new object based on existing ones', () => {
        const range = new SelectionRange(key1, key2);
        const range2 = range.withNewRange(key2);
        expect(range2.anchor().equals(key1)).toBe(true);
        expect(range2.range().equals(key2)).toBe(true);
        const range3 = range.withNewAnchor(key3);
        expect(range3.anchor().equals(key3)).toBe(true);
        expect(range3.range().equals(key2)).toBe(true);
        const range4 = SelectionRange.ofSingleItem(key2);
        expect(range4.anchor().equals(key2)).toBe(true);
        expect(range4.range().equals(key2)).toBe(true);
      });
    });

    it('properly test equality', () => {
      const range1 = new SelectionRange(key1, key2);
      const range2 = new SelectionRange(key1, key2);
      expect(range1.equals(range2)).toBe(true);
    });
  });
});
