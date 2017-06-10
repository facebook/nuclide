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

import typeof * as ImportService from './ImportService';

import invariant from 'assert';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {ServiceTester} from './ServiceTester';

describe('ImportService', () => {
  let testHelper;
  let service: ImportService;

  beforeEach(() => {
    testHelper = new ServiceTester();
    waitsForPromise(() => {
      invariant(testHelper);
      return testHelper.start(
        [
          {
            name: 'ImportService',
            definition: nuclideUri.join(__dirname, 'ImportService.js'),
            implementation: nuclideUri.join(__dirname, 'ImportService.js'),
          },
        ],
        'import_protocol',
      );
    });

    runs(() => {
      invariant(testHelper);
      service = testHelper.getRemoteService('ImportService');
    });
  });

  it('ImportService - basic type import', () => {
    waitsForPromise(async () => {
      invariant(service);
      const result = await service.f('msg');
      expect(result).toBe('msg');
    });
  });

  it('ImportService - type import requiring multiple imports of a ImportedType', () => {
    waitsForPromise(async () => {
      invariant(service);
      const result = await service.g({field: 'msg'});
      expect(result).toBe('msg');
    });
  });

  it('ImportService - type import of export specifiers', () => {
    waitsForPromise(async () => {
      invariant(service);
      const result = await service.f2('msg');
      expect(result).toBe('msg');
      const result2 = await service.f3('msg');
      expect(result2).toBe('msg');
    });
  });

  afterEach(() => {
    invariant(testHelper);
    return testHelper.stop();
  });
});
