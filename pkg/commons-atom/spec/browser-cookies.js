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

import browserCookies from '../browser-cookies';

describe('browser', () => {
  describe('getCookies', () => {
    it('gets cookies for a domain', () =>
      waitsForPromise(async () => {
        const cookies = await browserCookies.getCookies('example.com');
        expect(typeof cookies).toBe('object');
      }));
  });

  describe('setCookies', () => {
    it('can set cookies for a domain/URL', () =>
      waitsForPromise(async () => {
        const now = Date.now().toString();
        const cookiesBefore = await browserCookies.getCookies('example.com');
        expect(cookiesBefore.now).not.toBe(now);
        await browserCookies.setCookie(
          'http://example.com',
          'example.com',
          'now',
          now,
        );
        const cookiesAfter = await browserCookies.getCookies('example.com');
        expect(cookiesAfter.now).toBe(now);
      }));
  });
});
