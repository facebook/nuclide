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

import {Range} from 'atom';
import findWholeRangeOfSymbol from '../lib/findWholeRangeOfSymbol';
import {rangeMatchers} from '../../commons-atom/testHelpers';

describe('findWholeRangeOfSymbol', () => {
  let editor: atom$TextEditor = (null: any);

  beforeEach(function() {
    this.addMatchers(rangeMatchers);
    waitsForPromise(async () => {
      editor = await atom.workspace.open('sampleObjC.m');
    });
  });

  it('finds the range of a non-selector symbol.', () => {
    const text = 'name';
    const spelling = 'name';
    const textRangeInSample = new Range([8, 31], [8, 35]);
    const extent = new Range([8, 31], [8, 35]);
    const ranges = findWholeRangeOfSymbol(
      editor,
      text,
      textRangeInSample,
      spelling,
      extent,
    );
    // The range returned should just be the range of the original text.
    expect(ranges).toEqualAtomRanges([textRangeInSample]);
  });

  it('finds the range of a fully qualified non-selector symbol.', () => {
    const text = 'name';
    const spelling = 'namespace::name';
    const textRangeInSample = new Range([8, 31], [8, 35]);
    const extent = new Range([8, 31], [8, 35]);
    const ranges = findWholeRangeOfSymbol(
      editor,
      text,
      textRangeInSample,
      spelling,
      extent,
    );
    expect(ranges).toEqualAtomRanges([textRangeInSample]);
  });

  it('finds the range of a selector with one argument.', () => {
    const text = 'cStringUsingEncoding';
    const spelling = 'cStringUsingEncoding:';
    const textRangeInSample = new Range([12, 39], [12, 59]);
    const extent = new Range([12, 35], [12, 83]);
    const ranges = findWholeRangeOfSymbol(
      editor,
      text,
      textRangeInSample,
      spelling,
      extent,
    );
    // The range returned should just be the range of the original text + 1 for the colon.
    const expectedRange = new Range(textRangeInSample.start, [12, 60]);
    expect(ranges).toEqualAtomRanges([expectedRange]);
  });

  it(
    'finds the range of a selector with multiple arguments, when any of the segments is the' +
      ' selected "text".',
    () => {
      const spelling =
        'createDirectoryAtPath:withIntermediateDirectories:attributes:error:';
      // The ranges returned should be all the ranges of all the segments, including the colons.
      // location of textRangeInSample1 + 1 colon
      const expectedRange1 = new Range([17, 20], [17, 42]);
      // location of textRangeInSample2 + 1 colon
      const expectedRange2 = new Range([18, 14], [18, 42]);
      // location of textRangeInSample3 + 1 colon
      const expectedRange3 = new Range([19, 31], [19, 42]);
      // location of textRangeInSample4 + 1 colon
      const expectedRange4 = new Range([19, 46], [19, 52]);
      const expectedRanges = [
        expectedRange1,
        expectedRange2,
        expectedRange3,
        expectedRange4,
      ];
      const extent = Range.fromObject({
        start: {row: 17, column: 6},
        end: {row: 19, column: 56},
      });

      const text1 = 'createDirectoryAtPath';
      const textRangeInSample1 = new Range([17, 20], [17, 41]);
      const ranges1 = findWholeRangeOfSymbol(
        editor,
        text1,
        textRangeInSample1,
        spelling,
        extent,
      );
      expect(ranges1).toEqualAtomRanges(expectedRanges);

      const text2 = 'withIntermediateDirectories';
      const textRangeInSample2 = new Range([18, 14], [18, 41]);
      const ranges2 = findWholeRangeOfSymbol(
        editor,
        text2,
        textRangeInSample2,
        spelling,
        extent,
      );
      expect(ranges2).toEqualAtomRanges(expectedRanges);

      const text3 = 'attributes';
      const textRangeInSample3 = new Range([19, 31], [19, 41]);
      const ranges3 = findWholeRangeOfSymbol(
        editor,
        text3,
        textRangeInSample3,
        spelling,
        extent,
      );
      expect(ranges3).toEqualAtomRanges(expectedRanges);

      const text4 = 'createDirectoryAtPath';
      const textRangeInSample4 = new Range([19, 46], [19, 51]);
      const ranges4 = findWholeRangeOfSymbol(
        editor,
        text4,
        textRangeInSample4,
        spelling,
        extent,
      );
      expect(ranges4).toEqualAtomRanges(expectedRanges);
    },
  );
});
