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
import fs from 'fs';
import log4js from 'log4js';
import temp from 'temp';

temp.track();

jest.unmock('log4js');

describe('fileAppender', () => {
  let tempFile: string;
  beforeEach(() => {
    tempFile = temp.openSync().path;
    log4js.configure({
      appenders: [
        {
          type: require.resolve('../VendorLib/fileAppender'),
          filename: tempFile,
          maxLogSize: 1048576,
          backups: 1,
          layout: {
            type: 'pattern',
            // level category - message
            pattern: '%p %c - %m',
          },
        },
      ],
    });
  });

  it('flushes immediately on shutdown', async () => {
    const times = 10;
    const logger = log4js.getLogger('testCategory');
    for (let i = 0; i < times; i++) {
      logger.info('test1234');
    }
    await new Promise(resolve => log4js.shutdown(resolve));

    expect(fs.readFileSync(tempFile, 'utf8')).toBe(
      'INFO testCategory - test1234\n'.repeat(times),
    );
  });
});
