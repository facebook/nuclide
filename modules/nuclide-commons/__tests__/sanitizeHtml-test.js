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
import sanitize from '../sanitizeHtml';

it('removes html', () => {
  expect(sanitize('<h4>a lowly h4</h4>')).toBe('a lowly h4');
});

it('removes leading and trailing whitespace', () => {
  expect(sanitize('    a\nb    ', {condenseWhitespaces: false})).toBe('a\nb');
});

it('compresses whitespace with option', () => {
  expect(
    sanitize('    a\n     \n       b    ', {condenseWhitespaces: true}),
  ).toBe('a\nb');
  expect(
    sanitize('    a\n     \n       b    ', {condenseWhitespaces: false}),
  ).toBe('a\n     \n       b');
});

it('adds line breaks for <p> and <br /> tags', () => {
  expect(sanitize('a<br />b<p>c</p><p>d</p>')).toBe('a\nb\nc\nd');
  expect(sanitize('a<br/>b')).toBe('a\nb');
  expect(sanitize('a<br>b')).toBe('a\nb');
  expect(sanitize('a<br >b')).toBe('a\nb');
});
