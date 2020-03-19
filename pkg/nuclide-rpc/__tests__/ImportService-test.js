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
import typeof * as ImportService from '../__mocks__/ImportService';

import invariant from 'assert';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {ServiceTester} from '../__mocks__/ServiceTester';

describe('ImportService', () => {
  let testHelper;
  let service: ImportService;

  beforeEach(async () => {
    testHelper = new ServiceTester();
    await (() => {
      invariant(testHelper);
      return testHelper.start(
        [
          {
            name: 'ImportService',
            definition: nuclideUri.join(
              __dirname,
              '../__mocks__/ImportService.js',
            ),
            implementation: nuclideUri.join(
              __dirname,
              '../__mocks__/ImportService.js',
            ),
          },
        ],
        'import_protocol',
      );
    })();

    invariant(testHelper);
    service = testHelper.getRemoteService('ImportService');
  });

  it('ImportService - basic type import', async () => {
    invariant(service);
    const result = await service.f('msg');
    expect(result).toBe('msg');
  });

  it('ImportService - type import requiring multiple imports of a ImportedType', async () => {
    invariant(service);
    const result = await service.g({field: 'msg'});
    expect(result).toBe('msg');
  });

  it('ImportService - type import of export specifiers', async () => {
    invariant(service);
    const result = await service.f2('msg');
    expect(result).toBe('msg');
    const result2 = await service.f3('msg');
    expect(result2).toBe('msg');
  });

  afterEach(() => {
    invariant(testHelper);
    return testHelper.stop();
  });
});
