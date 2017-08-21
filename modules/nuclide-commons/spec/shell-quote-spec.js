/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import {parse, quote} from '../_shell-quote';

/**
 * The rest of shell-quote has been verified to work correctly.
 * We just need to test the comment parsing.
 */

describe('shell-quote', () => {
  describe('parse', () => {
    it('parses comments correctly', () => {
      expect(parse('beep#boop')).toEqual(['beep#boop']);
      expect(parse('beep #boop')).toEqual(['beep', {comment: 'boop'}]);
      expect(parse('beep # boop')).toEqual(['beep', {comment: 'boop'}]);
      expect(parse('beep # > boop')).toEqual(['beep', {comment: '> boop'}]);
      expect(parse('beep # "> boop"')).toEqual(['beep', {comment: '"> boop"'}]);
      expect(parse('beep "#"')).toEqual(['beep', '#']);
      expect(parse('beep #"#"#')).toEqual(['beep', {comment: '"#"#'}]);
      expect(parse('beep > boop # > foo')).toEqual([
        'beep',
        {op: '>'},
        'boop',
        {comment: '> foo'},
      ]);
    });
  });

  describe('quote', () => {
    expect(quote(['X#(){}*|][!'])).toBe('X\\#\\(\\)\\{\\}\\*\\|\\]\\[\\!');
  });
});
