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
jest.setTimeout(20000);

import typeof * as InfoService from '../../lib/services/InfoService';

import ServiceTestHelper from '../../__mocks__/services/ServiceTestHelper';
import {getVersion} from '../../../nuclide-version';
import invariant from 'assert';
import servicesConfig from '../../lib/servicesConfig';

describe('InfoService', () => {
  let testHelper;
  beforeEach(async () => {
    testHelper = new ServiceTestHelper();
    await (() => testHelper.start(servicesConfig))();
  });

  it('Returns the correct version number', async () => {
    invariant(testHelper);
    const service: InfoService = testHelper.getRemoteService('InfoService');

    const version = await service.getServerVersion();
    expect(version).toBe(getVersion());
  });

  afterEach(async () => testHelper.stop());
});
