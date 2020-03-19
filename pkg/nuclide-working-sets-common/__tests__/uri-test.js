/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
import * as uri from '../lib/uri';

describe('uri', () => {
  describe('dedupeUris', () => {
    it('linux paths', () => {
      expect(
        uri.dedupeUris(['/bbb/ccc/ddd', '/bbb/ccc', '/aaa/bbb', '/aaa/ccc']),
      ).toEqual(['/aaa/bbb', '/aaa/ccc', '/bbb/ccc']);
    });

    it('remote paths', () => {
      expect(
        uri.dedupeUris([
          'nuclide://host/bbb/ccc/ddd',
          'nuclide://host/bbb/ccc',
          'nuclide://host/aaa/bbb',
          'nuclide://host/aaa/ccc',
        ]),
      ).toEqual([
        'nuclide://host/aaa/bbb',
        'nuclide://host/aaa/ccc',
        'nuclide://host/bbb/ccc',
      ]);
    });

    it('diskless windows paths', () => {
      expect(
        uri.dedupeUris([
          '\\bbb\\ccc\\ddd',
          '\\bbb\\ccc',
          '\\aaa\\bbb',
          '\\aaa\\ccc',
        ]),
      ).toEqual(['\\aaa\\bbb', '\\aaa\\ccc', '\\bbb\\ccc']);
    });

    it('windows paths with a disk', () => {
      expect(
        uri.dedupeUris([
          'C:\\bbb\\ccc\\ddd',
          'C:\\bbb\\ccc',
          'C:\\aaa\\bbb',
          'C:\\aaa\\ccc',
        ]),
      ).toEqual(['C:\\aaa\\bbb', 'C:\\aaa\\ccc', 'C:\\bbb\\ccc']);
    });
  });
});
