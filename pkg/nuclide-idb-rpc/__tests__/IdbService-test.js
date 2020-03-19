/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @emails oncall+jackalope
 */

import * as IdbService from '../lib/IdbService';

describe('IDBService', () => {
  describe('startDaemon', () => {
    it('Starts a daemon process and returns port number.', async () => {
      const startMessage = await IdbService.startDaemon()
        .refCount()
        .first()
        .toPromise();

      expect(typeof startMessage.port === 'number').toBe(true);
    });
  });
});
