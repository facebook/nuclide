/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
import {
  _calculateColumnWidths,
  _calculatePreferredColumnWidths,
} from '../Table';

describe('Table', () => {
  it('correctly distributes widths according to percentage, regardless of min width', () => {
    const calculated = _calculateColumnWidths({
      preferredWidths: {a: 0.5, b: 0.5},
      minWidths: {a: 25, b: 50},
      tableWidth: 100,
      columnOrder: ['a', 'b'],
      resizeOffset: null,
    });
    expectClose(calculated, {a: 0.5, b: 0.5});
  });

  it("doesn't change the column widths when a resize is ended", () => {
    // This one's a little tricky. Basically, when you finish dragging a column, we interpret that
    // as indicating a new preference for column distributions. In order to avoid jumping in the UI,
    // all of the column widths MUST be continuous; in other words, the widths calculated from your
    // new distribution preferences must match the width calculated from your old distribution
    // preferences at that drag offset.
    const minWidths = {a: 25, b: 50};
    const tableWidth = 100;
    const columnOrder = ['a', 'b'];
    const duringDrag = _calculateColumnWidths({
      preferredWidths: {a: 0.5, b: 0.5},
      resizeOffset: {resizerLocation: 0, deltaPx: -10},
      minWidths,
      tableWidth,
      columnOrder,
    });
    expect(duringDrag).toEqual({a: 0.4, b: 0.6});
    const afterDrag = _calculateColumnWidths({
      preferredWidths: _calculatePreferredColumnWidths({
        currentWidths: duringDrag,
        minWidths,
        tableWidth,
      }),
      resizeOffset: null,
      minWidths,
      tableWidth,
      columnOrder,
    });
    expectClose(afterDrag, duringDrag);
  });

  it("doesn't allow resizing below a column's min width", () => {
    const calculated = _calculateColumnWidths({
      preferredWidths: {a: 0.5, b: 0.5},
      minWidths: {a: 25, b: 50},
      tableWidth: 100,
      columnOrder: ['a', 'b'],
      resizeOffset: {resizerLocation: 0, deltaPx: -50},
    });
    expectClose(calculated, {a: 0.25, b: 0.75});
  });

  it('recognizes when a column is at its min width when calculating preferred distributions', () => {
    const preferredWidths = _calculatePreferredColumnWidths({
      currentWidths: {a: 0.2, b: 0.2, c: 0.6},
      minWidths: {a: 25, b: 0, c: 0},
      tableWidth: 100,
    });
    // The user prefers "a" to be at its min width, i.e. have a 0 distribution, and the other
    // columns to have a 1:3 ratio.
    expectClose(preferredWidths, {a: 0, b: 0.25, c: 0.75});
  });

  it('shrinks multiple columns to their minimum if it has to in order to accomodate your resize', () => {
    const calculated = _calculateColumnWidths({
      preferredWidths: {a: 0.25, b: 0.25, c: 0.25, d: 0.25},
      minWidths: {a: 10, b: 10, c: 10, d: 10},
      tableWidth: 100,
      columnOrder: ['a', 'b', 'c', 'd'],
      resizeOffset: {resizerLocation: 0, deltaPx: 35},
    });
    expectClose(calculated, {a: 0.6, b: 0.1, c: 0.1, d: 0.2});
  });
});

// Because we're dealing with percentages represented as floating point numbers, a little bit of
// deviation is expected. (`1 - 0.1 - 0.1 - 0.1 !== 0.7`)
const expectClose = (a, b) => {
  expect(Object.keys(a).length).toBe(Object.keys(b).length);
  Object.keys(a).forEach(k => {
    expect(a[k]).toBeCloseTo(b[k], 10);
  });
};
