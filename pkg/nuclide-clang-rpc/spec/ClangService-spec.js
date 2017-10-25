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
import {generateFixture} from 'nuclide-commons/test-helpers';
import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';

describe('ClangService.formatCode', () => {
  it('uses clang-format correctly', () => {
    waitsForPromise(async () => {
      const fixtureCode = await fsPromise.readFile(
        nuclideUri.join(__dirname, 'fixtures/test.cpp'),
        'utf8',
      );
      const projectDir = await generateFixture(
        'project',
        new Map([['test.cpp', fixtureCode]]),
      );
      const testFile = nuclideUri.join(projectDir, 'test.cpp');
      const spy = spyOn(
        require('nuclide-commons/process'),
        'runCommand',
      ).andReturn(Observable.of('{ "Cursor": 4, "Incomplete": false }\ntest2'));
      const result = await formatCode(testFile, 'test', 1, 2, 3);
      expect(result).toEqual({
        newCursor: 4,
        formatted: 'test2',
      });
      expect(spy).toHaveBeenCalledWith(
        'clang-format',
        [
          '-style=file',
          '-assume-filename=' + testFile,
          '-cursor=1',
          '-offset=2',
          '-length=3',
        ],
        {input: 'test'},
      );
    });
  });
});
