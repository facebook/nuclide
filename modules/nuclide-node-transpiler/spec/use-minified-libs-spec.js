/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @noflow
 */
'use strict';

/* eslint
  comma-dangle: [1, always-multiline],
  prefer-object-spread/prefer-object-spread: 0,
  nuclide-internal/no-commonjs: 0,
  */
/* eslint-disable max-len */

const babel = require('babel-core');
const dedent = require('dedent');

function transform(source, extraPlugins) {
  return babel.transform(source, {
    plugins: (extraPlugins || []).concat([
      require('babel-plugin-syntax-flow'),
      require('../lib/use-minified-libs-tr'),
    ]),
  }).code;
}

describe('use-minified-libs transform', () => {
  it('export-all-minified', () => {
    expect(transform(dedent`
      export * from 'rxjs';
    `)).toEqual(dedent`
      export * from 'rxjs/bundles/Rx.min.js';
    `);
  });

  it('export-named-minified', () => {
    expect(transform(dedent`
      export {Observable} from 'rxjs';
    `)).toEqual(dedent`
      export { Observable } from 'rxjs/bundles/Rx.min.js';
    `);
  });

  it('ignore-other', () => {
    expect(transform(dedent`
      import path from 'path';
    `)).toEqual(dedent`
      import path from 'path';
    `);
  });

  it('import-minified', () => {
    expect(transform(dedent`
      import Rx from 'rxjs';
      import {Observable} from 'rxjs';
      assert(Rx.Observable === Observable);
    `)).toEqual(dedent`
      import Rx from 'rxjs/bundles/Rx.min.js';
      import { Observable } from 'rxjs/bundles/Rx.min.js';
      assert(Rx.Observable === Observable);
    `);
  });

  it('no-type', () => {
    expect(transform(dedent`
      import type {using} from 'rxjs/observable/using';
    `)).toEqual(dedent`
      import type { using } from 'rxjs/observable/using';
    `);
  });

  it('require-minified', () => {
    expect(transform(dedent`
      const Rx = require('rxjs');
      const {Observable} = require('rxjs');
      assert(Rx.Observable === Observable);
    `)).toEqual(dedent`
      const Rx = require('rxjs/bundles/Rx.min.js');
      const { Observable } = require('rxjs/bundles/Rx.min.js');
      assert(Rx.Observable === Observable);
    `);
  });

  it('with-inline-imports', () => {
    expect(transform(dedent`
      import Rx from 'rxjs';
      assert(Rx.Observable === Observable);
    `, [
      require('babel-plugin-transform-inline-imports-commonjs'),
    ])).toEqual(dedent`
      'use strict';

      var _RxMin;

      function _load_RxMin() {
        return _RxMin = _interopRequireDefault(require('rxjs/bundles/Rx.min.js'));
      }

      function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

      assert((_RxMin || _load_RxMin()).default.Observable === Observable);
    `);
  });

  it('only-entry-module', () => {
    expect(() => {
      transform(transform(dedent`
        import {using} from 'rxjs/observable/using';
      `));
    }).toThrow(
      new SyntaxError('unknown: Only importing "rxjs" is supported. rxjs/observable/using')
    );
  });
});
