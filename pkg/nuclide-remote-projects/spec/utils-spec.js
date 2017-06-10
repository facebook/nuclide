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

import {sanitizeNuclideUri} from '../lib/utils';

describe('Utils Test Suite', () => {
  describe('sanitizeUri()', () => {
    it('returns a clean url from a normalized url version', () => {
      const normalizedUrl = 'nuclide:/abc.fb.com/some/path';
      const fixedUrl = sanitizeNuclideUri(normalizedUrl);
      expect(fixedUrl).toBe('nuclide://abc.fb.com/some/path');
    });

    it('returns a clean url from a normalized and path prepended url version', () => {
      const brokenUrl =
        '/some_path/abosolute/atom/nuclide:/abc.fb.com/some/path';
      const fixedUrl = sanitizeNuclideUri(brokenUrl);
      expect(fixedUrl).toBe('nuclide://abc.fb.com/some/path');
    });

    it('returns the same url if it is valid url', () => {
      const url = 'nuclide://abc.fb.com/some/path';
      expect(sanitizeNuclideUri(url)).toBe(url);
      const ftpUrl = 'ftp://abc.fb.com/some/path';
      expect(sanitizeNuclideUri(ftpUrl)).toBe(ftpUrl);
    });
  });
});
