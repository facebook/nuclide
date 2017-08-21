/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @noflow
 */
'use strict';

/* eslint
  comma-dangle: [1, always-multiline],
  prefer-object-spread/prefer-object-spread: 0,
  nuclide-internal/no-commonjs: 0,
  */

const babel = require('babel-core');
const dedent = require('dedent');

function transform(source) {
  return babel.transform(source, {
    plugins: [
      require('babel-plugin-syntax-flow'),
      require('../lib/inline-invariant-tr'),
    ],
  }).code;
}

describe('inline-invariant transform', () => {
  it('works 1', () => {
    expect(transform(dedent`
      import invariant from '';
      invariant(false);
    `)).toEqual(dedent`
      if (!false) {
        throw new Error('Invariant violation: "false"');
      }
    `);
  });

  it('works 2', () => {
    expect(transform(dedent`
      import invariant from '';
      invariant(false != true);
    `)).toEqual(dedent`
      if (!(false != true)) {
        throw new Error('Invariant violation: "false != true"');
      }
    `);
  });

  it('works 3', () => {
    expect(transform(dedent`
      import invariant from '';
      invariant(foo() ? !!bar : baz.qux());
    `)).toEqual(dedent`
      if (!(foo() ? !!bar : baz.qux())) {
        throw new Error('Invariant violation: "foo() ? !!bar : baz.qux()"');
      }
    `);
  });

  it('works 4', () => {
    expect(transform(dedent`
      import invariant from '';
      invariant(true, 'it is true');
    `)).toEqual(dedent`
      if (!true) {
        throw new Error('it is true');
      }
    `);
  });

  it('works 5', () => {
    expect(transform(dedent`
      import {invariant} from '';
      invariant(true, 'it is true');
    `)).toEqual(dedent`
      if (!true) {
        throw new Error('it is true');
      }
    `);
  });

  it('works 6', () => {
    expect(transform(dedent`
      import invariant from '';
      invariant(true, 'it is true');
      invariant.ok();
    `)).toEqual(dedent`
      import invariant from '';

      if (!true) {
        throw new Error('it is true');
      }

      invariant.ok();
    `);
  });

  it('works 7', () => {
    expect(transform(dedent`
      export { invariant } from ''
    `)).toEqual(dedent`
      export { invariant } from '';
    `);
  });

  it('works 8', () => {
    expect(transform(dedent`
      import {default as invariant} from ''
      invariant(true);
    `)).toEqual(dedent`
      if (!true) {
        throw new Error('Invariant violation: "true"');
      }
    `);
  });

  it('works 9', () => {
    expect(transform(dedent`
      invariant;
    `)).toEqual(dedent`
      invariant;
    `);
  });

  it('works 10', () => {
    expect(transform(dedent`
      var invariant = require('invariant');
    `)).toEqual(dedent`
      var invariant = require('invariant');
    `);
  });

  it('works 11', () => {
    expect(transform(dedent`
      var invariant = require('invariant');
      invariant(true);
    `)).toEqual(dedent`
      var invariant = require('invariant');
      invariant(true);
    `);
  });

  it('works 12', () => {
    expect(transform(dedent`
      import invariant from 'invariant';
      foo;
    `)).toEqual('\nfoo;');
  });

  it('works 13', () => {
    expect(() => {
      transform(dedent`
        import invariant from 'invariant';
        if (invariant(true)) {}
      `);
    }).toThrow(
      new SyntaxError('unknown: `invariant()` must be used as an expression statement.')
    );
  });

  it('works 14', () => {
    expect(() => {
      transform(dedent`
        import invariant from 'invariant';
        invariant();
      `);
    }).toThrow(
      new SyntaxError('unknown: `invariant()` must at least one argument.')
    );
  });
});
