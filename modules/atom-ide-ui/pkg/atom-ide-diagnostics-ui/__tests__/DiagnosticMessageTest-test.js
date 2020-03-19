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
import {separateUrls} from '../lib/ui/DiagnosticsMessageText';

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

  it('should handle URLs that include escaped characters', () => {
    expect(
      separateUrls('https://example.com/give%20me%20some%20space/'),
    ).toEqual([
      {isUrl: false, text: ''},
      {isUrl: true, url: 'https://example.com/give%20me%20some%20space/'},
      {isUrl: false, text: ''},
    ]);
  });

  it('should handle URLs that include a query', () => {
    expect(
      separateUrls(
        'help: https://example.com/foo.html?q=%20+!&-._~:@/?-hmm. (weird url huh?)',
      ),
    ).toEqual([
      {isUrl: false, text: 'help: '},
      {isUrl: true, url: 'https://example.com/foo.html?q=%20+!&-._~:@/?-hmm'},
      {isUrl: false, text: '. (weird url huh?)'},
    ]);
  });

  it('should handle URLs that include a fragment', () => {
    expect(
      separateUrls(
        'help: https://example.com/foo.html#frag%20+!&=-._~:@/?-name. (weird url huh?)',
      ),
    ).toEqual([
      {isUrl: false, text: 'help: '},
      {
        isUrl: true,
        url: 'https://example.com/foo.html#frag%20+!&=-._~:@/?-name',
      },
      {isUrl: false, text: '. (weird url huh?)'},
    ]);
  });
});
