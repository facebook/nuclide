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
jest.unmock('log4js');

global.NUCLIDE_DO_NOT_LOG = false;

import {runCommand, LOG_CATEGORY} from 'nuclide-commons/process';
import {trackSampled} from 'nuclide-commons/analytics';
import log4js from 'log4js';
import waitsFor from '../../../jest/waits_for';

describe('processTrackingAppender', () => {
  it('captures process exits', async () => {
    log4js.configure({
      appenders: [
        {
          type: require.resolve('../lib/processTrackingAppender'),
          category: LOG_CATEGORY,
        },
      ],
    });

    await runCommand('true', ['1']).toPromise();

    await waitsFor(() => (trackSampled: any).mock.calls.length > 0);

    expect(trackSampled).toHaveBeenCalledWith('process-exit', 10, {
      command: 'true 1',
      duration: expect.any(Number),
    });
  });
});
