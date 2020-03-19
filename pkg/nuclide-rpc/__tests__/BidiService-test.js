/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */
import nuclideUri from 'nuclide-commons/nuclideUri';
import {ServiceTester} from '../__mocks__/ServiceTester';
import typeof * as BidiServiceType from '../__mocks__/BidiService';

class I1 {
  async m(arg: string): Promise<string> {
    return 'I1:' + arg;
  }

  dispose() {}
}

class I2 {
  async m(arg: string): Promise<string> {
    return 'I2:' + arg;
  }

  dispose() {}
}

describe('BidiService', () => {
  let testHelper;
  let service: BidiServiceType = (null: any);
  beforeEach(async () => {
    testHelper = new ServiceTester();
    await testHelper.start(
      [
        {
          name: 'BidiService',
          definition: nuclideUri.join(
            __dirname,
            '../__mocks__/BidiService.def',
          ),
          implementation: nuclideUri.join(
            __dirname,
            '../__mocks__/BidiService.js',
          ),
        },
      ],
      'bidi_protocol',
    );
    service = testHelper.getRemoteService('BidiService');
  });

  it('Test calls from server back to client', async () => {
    const i1 = new I1();
    const i2 = new I2();

    const r1 = await service.f('call1', i1);
    const r2 = await service.f('call2', i2);

    expect(r1).toBe('I1:call1');
    expect(r2).toBe('I2:call2');
  });

  afterEach(() => testHelper.stop());
});
