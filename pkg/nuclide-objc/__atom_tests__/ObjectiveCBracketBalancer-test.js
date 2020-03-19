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
import {Point, TextBuffer} from 'atom';
import ObjectiveCBracketBalancer from '../lib/ObjectiveCBracketBalancer';

const {getOpenBracketInsertPosition} = ObjectiveCBracketBalancer;

describe('ObjectiveCBracketBalancer', () => {
  describe('getOpenBracketInsertPosition', () => {
    it(
      'returns the correct point on a line that contains no space before the close' +
        ' bracket',
      () => {
        expect(
          getOpenBracketInsertPosition(
            new TextBuffer(']'),
            Point.fromObject([0, 0]),
          ),
        ).toEqual(Point.fromObject([0, 0]));
      },
    );

    it(
      'returns the correct point on a line that contains only whitespace before the close' +
        ' bracket',
      () => {
        expect(
          getOpenBracketInsertPosition(
            new TextBuffer('   ]'),
            Point.fromObject([0, 3]),
          ),
        ).toEqual(Point.fromObject([0, 3]));
      },
    );

    it('inserts an open bracket at the start of an unbalanced simple expression', () => {
      expect(
        getOpenBracketInsertPosition(
          new TextBuffer('self setEnabled:NO]'),
          Point.fromObject([0, 18]),
        ),
      ).toEqual(Point.fromObject([0, 0]));
    });

    it('does not insert an open bracket when completing a balanced simple expression', () => {
      expect(
        getOpenBracketInsertPosition(
          new TextBuffer('[self setEnabled:NO]'),
          Point.fromObject([0, 19]),
        ),
      ).toEqual(null);
    });

    it('inserts an open bracket at the beginning of an unbalanced nested expression', () => {
      expect(
        getOpenBracketInsertPosition(
          new TextBuffer('[self foo] setEnabled:NO]'),
          Point.fromObject([0, 24]),
        ),
      ).toEqual(Point.fromObject([0, 0]));
    });

    it('does not insert an open bracket when completing a balanced nested expression', () => {
      expect(
        getOpenBracketInsertPosition(
          new TextBuffer('[[self foo] setEnabled:NO]'),
          Point.fromObject([0, 25]),
        ),
      ).toEqual(null);
    });

    it(
      'inserts an open bracket at the beginning of an unbalanced nested expression with an open' +
        ' bracket in a string literal',
      () => {
        expect(
          getOpenBracketInsertPosition(
            new TextBuffer('[self fooWithBar:@"tricky ["] setEnabled:NO]'),
            Point.fromObject([0, 43]),
          ),
        ).toEqual(Point.fromObject([0, 0]));
      },
    );

    it(
      'inserts an open bracket at the beginning of an unbalanced nested expression with an open' +
        ' bracket in a char literal',
      () => {
        expect(
          getOpenBracketInsertPosition(
            new TextBuffer("[self fooWithBar:'['] setEnabled:NO]"),
            Point.fromObject([0, 35]),
          ),
        ).toEqual(Point.fromObject([0, 0]));
      },
    );

    it(
      'does not insert an open bracket at the beginning of a balanced nested expression with an' +
        ' open bracket in a char literal',
      () => {
        expect(
          getOpenBracketInsertPosition(
            new TextBuffer("[foo('[') setEnabled:NO]"),
            Point.fromObject([0, 23]),
          ),
        ).toEqual(null);
      },
    );

    it(
      'inserts an open bracket before the nearest expression when within an existing balanced' +
        ' bracket pair',
      () => {
        // Start with:  [self setFoo:@"bar" |]
        //                          cursor  ^
        // Type ] and we should insert the [ before @"bar"
        // Ending with: [self setFoo:[@"bar" ]]
        expect(
          getOpenBracketInsertPosition(
            new TextBuffer('[self setFoo:@"bar" ]'),
            Point.fromObject([0, 20]),
          ),
        ).toEqual(Point.fromObject([0, 13]));
      },
    );

    it('inserts an open bracket at the beginning of an unbalanced expression across multiple lines', () => {
      expect(
        getOpenBracketInsertPosition(
          new TextBuffer('foo setFoo:@"foo"\nbar:@"bar"\nbaz:@"baz"]'),
          Point.fromObject([2, 10]),
        ),
      ).toEqual(Point.fromObject([0, 0]));
    });

    it(
      'does not insert an open bracket at the beginning of a balanced expression across multiple' +
        ' lines',
      () => {
        expect(
          getOpenBracketInsertPosition(
            new TextBuffer('[foo setFoo:@"foo"\nbar:@"bar"\nbaz:@"baz"]'),
            Point.fromObject([2, 10]),
          ),
        ).toEqual(null);
      },
    );

    it('inserts an open bracket after an equals sign when initalizing or messaging a class', () => {
      expect(
        getOpenBracketInsertPosition(
          new TextBuffer('NSObject *foo = NSObject alloc]'),
          Point.fromObject([0, 30]),
        ),
      ).toEqual(Point.fromObject([0, 16]));
    });

    it(
      'does not insert an open bracket after an equals sign when initalizing or messaging a class' +
        ' with balanced brackets',
      () => {
        expect(
          getOpenBracketInsertPosition(
            new TextBuffer('[[NSObject alloc] init]'),
            Point.fromObject([0, 22]),
          ),
        ).toEqual(null);
      },
    );
  });
});
