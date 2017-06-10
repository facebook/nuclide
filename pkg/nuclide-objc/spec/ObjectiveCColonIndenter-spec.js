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

import {Point, TextBuffer} from 'atom';

import ObjectiveCColonIndenter from '../lib/ObjectiveCColonIndenter';
const {getIndentedColonColumn} = ObjectiveCColonIndenter;

describe('ObjectiveCColonIndenter', () => {
  describe('getIndentedColonColumn', () => {
    it('returns null if no colons are found for a method declaration', () => {
      expect(
        getIndentedColonColumn(
          new TextBuffer(
            `
              + (Type *)arg
              arg:`,
          ),
          Point.fromObject([2, 17]),
        ),
      ).toBeNull();
    });

    it('works on class method declarations', () => {
      expect(
        getIndentedColonColumn(
          new TextBuffer(
            `
              + (Type *)arg:(Type *)value
              arg:`,
          ),
          Point.fromObject([2, 17]),
        ),
      ).toEqual(27);
    });

    it('works on instance method declarations', () => {
      expect(
        getIndentedColonColumn(
          new TextBuffer(
            `
              - (Type *)arg:(Type *)value
              arg:`,
          ),
          Point.fromObject([2, 17]),
        ),
      ).toEqual(27);
    });

    it('returns null for single-line method calls', () => {
      expect(
        getIndentedColonColumn(
          new TextBuffer('[obj arg:value :'),
          Point.fromObject([0, 15]),
        ),
      ).toBeNull();
    });

    it('works on multi-line method calls', () => {
      expect(
        getIndentedColonColumn(
          new TextBuffer(
            `
              [obj arg:value
                   arg:value
              arg:`,
          ),
          Point.fromObject([3, 17]),
        ),
      ).toEqual(22);
    });

    it('returns null if no colons are found for a method call', () => {
      expect(
        getIndentedColonColumn(
          new TextBuffer(
            `
              [obj arg
              arg:`,
          ),
          Point.fromObject([2, 17]),
        ),
      ).toBeNull();
    });

    it('returns null if no key characters are found', () => {
      expect(
        getIndentedColonColumn(
          new TextBuffer(
            `
              obj arg
              arg:`,
          ),
          Point.fromObject([2, 17]),
        ),
      ).toBeNull();
    });

    it('works when the first line of the method has multiple colons', () => {
      expect(
        getIndentedColonColumn(
          new TextBuffer(
            `
              [obj arg:value arg:value
              arg:`,
          ),
          Point.fromObject([2, 17]),
        ),
      ).toEqual(22);
    });

    it('works when the previous line is not indented properly', () => {
      expect(
        getIndentedColonColumn(
          new TextBuffer(
            `
              [obj arg:value
              arg:value
              arg:`,
          ),
          Point.fromObject([3, 17]),
        ),
      ).toEqual(22);
    });

    it('works when the method is nested and on the same line as the outer method', () => {
      expect(
        getIndentedColonColumn(
          new TextBuffer(
            `
              [obj arg:[obj value:
              arg:`,
          ),
          Point.fromObject([2, 17]),
        ),
      ).toEqual(33);
    });

    it('works when a previous argument is a nested method', () => {
      expect(
        getIndentedColonColumn(
          new TextBuffer(
            `
              [obj arg:[obj arg:value]
              arg:`,
          ),
          Point.fromObject([2, 17]),
        ),
      ).toEqual(22);
    });
  });
});
