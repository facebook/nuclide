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

import {separateUrls} from '../lib/DiagnosticsMessageText';

describe('DiagnosticsMessageText', () => {
  it('should leave text unchanged', () => {
    expect(separateUrls('hello')).toEqual([{isUrl: false, text: 'hello'}]);
  });

  it('should handle a lone URL', () => {
    expect(separateUrls('http://example.com')).toEqual([
      {isUrl: false, text: ''},
      {isUrl: true, url: 'http://example.com'},
      {isUrl: false, text: ''},
    ]);
  });

  it('should separate URLs', () => {
    expect(
      separateUrls(
        'foo https://example.com/short-link bar https://example.com/abc_def0 baz',
      ),
    ).toEqual([
      {isUrl: false, text: 'foo '},
      {isUrl: true, url: 'https://example.com/short-link'},
      {isUrl: false, text: ' bar '},
      {isUrl: true, url: 'https://example.com/abc_def0'},
      {isUrl: false, text: ' baz'},
    ]);
  });

  it('should handle URLs at the beginning', () => {
    expect(separateUrls('https://example.com/123 end')).toEqual([
      {isUrl: false, text: ''},
      {isUrl: true, url: 'https://example.com/123'},
      {isUrl: false, text: ' end'},
    ]);
  });

  it('should handle URLs at the end', () => {
    expect(separateUrls('beginning https://example.com/foo.html')).toEqual([
      {isUrl: false, text: 'beginning '},
      {isUrl: true, url: 'https://example.com/foo.html'},
      {isUrl: false, text: ''},
    ]);
  });

  it('should not include trailing periods in URLs', () => {
    expect(separateUrls('hello https://example.com/short-link.')).toEqual([
      {isUrl: false, text: 'hello '},
      {isUrl: true, url: 'https://example.com/short-link'},
      {isUrl: false, text: '.'},
    ]);
  });
});
