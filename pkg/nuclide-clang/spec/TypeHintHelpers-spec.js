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

import {Point, Range} from 'atom';

import libclang from '../lib/libclang';
import TypeHintHelpers from '../lib/TypeHintHelpers';

describe('TypeHintHelpers', () => {
  const mockEditor: atom$TextEditor = (null: any);
  let mockDeclaration;
  beforeEach(() => {
    spyOn(libclang, 'getDeclaration').andCallFake(async () => mockDeclaration);
  });

  it('can return a typehint', () => {
    waitsForPromise(async () => {
      mockDeclaration = {
        type: 'test',
        extent: new Range([0, 0], [1, 1]),
      };

      const hint = await TypeHintHelpers.typeHint(mockEditor, new Point(0, 0));
      expect(hint).toEqual({
        hint: 'test',
        range: new Range(new Point(0, 0), new Point(1, 1)),
      });
    });
  });

  it('truncates lengthy typehints', () => {
    waitsForPromise(async () => {
      mockDeclaration = {
        type: 'a'.repeat(512),
        extent: new Range([0, 0], [1, 1]),
      };

      const hint = await TypeHintHelpers.typeHint(mockEditor, new Point(0, 0));
      expect(hint).toEqual({
        hint: 'a'.repeat(256) + '...',
        range: new Range(new Point(0, 0), new Point(1, 1)),
      });
    });
  });

  it('returns null when typehints are unavailable', () => {
    waitsForPromise(async () => {
      mockDeclaration = {
        type: null,
        extent: {range: new Range([0, 0], [1, 1])},
      };

      const hint = await TypeHintHelpers.typeHint(mockEditor, new Point(0, 0));
      expect(hint).toBe(null);
    });
  });
});
