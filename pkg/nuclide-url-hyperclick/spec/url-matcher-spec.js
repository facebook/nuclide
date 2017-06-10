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

import {matchUrl} from '../lib/HyperclickProviderHelpers';

function expectMatch(
  urlText: string,
  expectedMatch: ?{url: string, index: number},
) {
  const match = matchUrl(urlText);
  expect(match).toEqual(expectedMatch);
}

describe('urlregexp', () => {
  it('matches simple comment url', () => {
    const url = 'https://www.something.com/search?q=npm+urlregexp#123';
    const commentUrl = `// Comment: ${url}`;
    expectMatch(commentUrl, {url, index: 12});
  });

  it('matches url with surrounding () and port number', () => {
    const url = 'https://website.com:3233/search?q=npm+urlregexp#123';
    const urlText = `(${url})`;
    expectMatch(urlText, {url, index: 1});
  });

  it('matches urls in html tags', () => {
    const url = 'https://some.domain.com/picture/1234';
    const imageTagUrl = `<image src="${url}" />`;
    expectMatch(imageTagUrl, {url, index: 12});
  });

  it('matches urls in compact JSON config form', () => {
    const url = 'https://www.domain.com/api!/id832375956?mt=8';
    const confligLine = `"some_uri":"${url}"`;
    expectMatch(confligLine, {url, index: 12});
  });

  it('matches urls in strings', () => {
    const url = 'https://www.sub.domain.com/do/something?q=1234567.435';
    const urlInArgument = `URI('${url}')`;
    expectMatch(urlInArgument, {url, index: 5});
  });

  it('does not match string construction strings', () => {
    const urlConstruction =
      'return "https://" + prefix + ".facebook.com/en_US/AudienceNetworkVPAIDForFlash.js"';
    expectMatch(urlConstruction, null);
  });

  it('does not match url regex', () => {
    const urlRegex = '/^https://(?:[a-z0-9-]{1,63}.)+/';
    expectMatch(urlRegex, null);
  });

  it('matches long sudomain strings', () => {
    const serverUrl =
      'https://tby-54-35-234-321.us-west-2.compute.plat_test.com/';
    const urlArgument = `  "${serverUrl}"`;
    expectMatch(urlArgument, {url: serverUrl, index: 3});
  });

  it('matches urls with `www`, but no `https?`', () => {
    const wwwUrl = 'www.example.com/dsagf?4327=dfgsa';
    const urlArgument = `  '${wwwUrl}'`;
    expectMatch(urlArgument, {url: wwwUrl, index: 3});
  });

  it('match string argument with encoded url args', () => {
    const url =
      'https://website.com/tasks?q=%22and%22%2C%22contains%22%2C%22tags%22%2C';
    const urlText = `URI('${url}')`;
    expectMatch(urlText, {url, index: 5});
  });

  it('match url, but ignores the trailing punctuation', () => {
    const url = 'www.website.com';
    const urlText = `Checkout ${url}`;
    expectMatch(urlText, {url, index: 9});
  });
});
