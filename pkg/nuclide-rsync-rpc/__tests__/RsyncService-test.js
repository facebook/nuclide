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

import nuclideUri from 'nuclide-commons/nuclideUri';
import {observeProcess} from 'nuclide-commons/process';
import * as RsyncService from '../lib/RsyncService';
import fsPromise from 'nuclide-commons/fsPromise';

const testDir = nuclideUri.join(__dirname, '../__mocks__/testdir');

describe('RsyncService', () => {
  describe('startDaemon', () => {
    it('Starts a daemon process and returns version / port number.', async () => {
      const startMessage = await RsyncService.startDaemon(testDir)
        .refCount()
        .first()
        .toPromise();

      expect(typeof startMessage.port === 'number').toBe(true);
      expect(typeof startMessage.version === 'string').toBe(true);
    });
  });

  describe('getVersion', () => {
    it('Returns the CLI and protocol version.', async () => {
      const version = await RsyncService.getVersion();

      expect(typeof version.rsyncVersion === 'string').toBe(true);
      expect(typeof version.protocolVersion === 'number').toBe(true);
    });
  });

  describe('syncFolder', () => {
    it('Syncs a folder using the rsync daemon.', async () => {
      const targetDir = await fsPromise.tempdir();

      await RsyncService.startDaemon(testDir)
        .refCount()
        .switchMap(({port}) => {
          return RsyncService.syncFolder(
            `rsync://localhost:${port}/files/`,
            targetDir,
          )
            .refCount()
            .materialize();
        })
        // $FlowFixMe dematerialize
        .dematerialize()
        .toPromise();

      await observeProcess('diff', ['-r', testDir, targetDir]).toPromise();
    });
  });
});
