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
import {Range} from 'atom';
import findWholeRangeOfSymbol from '../lib/findWholeRangeOfSymbol';

describe('findWholeRangeOfSymbol', () => {
  let editor: atom$TextEditor = (null: any);

  beforeEach(async () => {
    editor = await atom.workspace.open('sampleObjC.m');
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
    expect(ranges).toMatchSnapshot();
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
    expect(ranges).toMatchSnapshot();
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
    expect(ranges).toMatchSnapshot();
  });

  it(
    'finds the range of a selector with multiple arguments, when any of the segments is the' +
      ' selected "text".',
    () => {
      const spelling =
        'createDirectoryAtPath:withIntermediateDirectories:attributes:error:';
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
      expect(ranges1).toMatchSnapshot();

      const text2 = 'withIntermediateDirectories';
      const textRangeInSample2 = new Range([18, 14], [18, 41]);
      const ranges2 = findWholeRangeOfSymbol(
        editor,
        text2,
        textRangeInSample2,
        spelling,
        extent,
      );
      expect(ranges2).toMatchSnapshot();

      const text3 = 'attributes';
      const textRangeInSample3 = new Range([19, 31], [19, 41]);
      const ranges3 = findWholeRangeOfSymbol(
        editor,
        text3,
        textRangeInSample3,
        spelling,
        extent,
      );
      expect(ranges3).toMatchSnapshot();

      const text4 = 'createDirectoryAtPath';
      const textRangeInSample4 = new Range([19, 46], [19, 51]);
      const ranges4 = findWholeRangeOfSymbol(
        editor,
        text4,
        textRangeInSample4,
        spelling,
        extent,
      );
      expect(ranges4).toMatchSnapshot();
    },
  );
});
