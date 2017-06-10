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

import {formatCode} from '..';
import {Observable} from 'rxjs';

describe('ClangService.formatCode', () => {
  it('uses clang-format correctly', () => {
    waitsForPromise(async () => {
      const spy = spyOn(
        require('nuclide-commons/process'),
        'runCommand',
      ).andReturn(Observable.of('{ "Cursor": 4, "Incomplete": false }\ntest2'));
      const result = await formatCode('test.cpp', 'test', 1, 2, 3);
      expect(result).toEqual({
        newCursor: 4,
        formatted: 'test2',
      });
      expect(spy).toHaveBeenCalledWith(
        'clang-format',
        [
          '-style=file',
          '-assume-filename=test.cpp',
          '-cursor=1',
          '-offset=2',
          '-length=3',
        ],
        {input: 'test'},
      );
    });
  });
});
