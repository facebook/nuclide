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

import type {ServerStatusUpdate} from '../../nuclide-flow-rpc';

import {Observable} from 'rxjs';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {addMatchers} from '../../nuclide-test-helpers';

import {serverStatusUpdatesToBusyMessages} from '..';

describe('serverStatusUpdatesToBusyMessages', () => {
  beforeEach(function() {
    addMatchers(this);
  });

  it('should work', () => {
    waitsForPromise(async () => {
      const input: Array<ServerStatusUpdate> = [
        {
          pathToRoot: 'nuclide://host.example.com/remote/root',
          status: 'not running',
        },
        {
          pathToRoot: '/local/root',
          status: 'busy',
        },
        {
          pathToRoot: 'nuclide://host.example.com/remote/root',
          status: 'init',
        },
        {
          pathToRoot: '/local/root',
          status: 'ready',
        },
        {
          pathToRoot: 'nuclide://host.example.com/remote/root',
          status: 'ready',
        },
        // Ending the stream should also dispose this one.
        {
          pathToRoot: '/local/test',
          status: 'busy',
        },
      ];
      const expected = [
        {
          message: 'Flow server is busy (/local/root)',
        },
        {
          message: 'Flow server is initializing (host.example.com:/remote/root)',
        },
        {
          message: 'Flow server is busy (/local/root)',
          dispose: true,
        },
        {
          message: 'Flow server is initializing (host.example.com:/remote/root)',
          dispose: true,
        },
        {
          message: 'Flow server is busy (/local/test)',
        },
        {
          message: 'Flow server is busy (/local/test)',
          dispose: true,
        },
      ];

      const messages = [];
      const mockBusySignal = {
        reportBusyWhile() {
          throw new Error('stub');
        },
        reportBusy(message) {
          messages.push({message});
          return new UniversalDisposable(() => {
            messages.push({message, dispose: true});
          });
        },
        dispose() {},
      };
      serverStatusUpdatesToBusyMessages(Observable.from(input), mockBusySignal);
      expect(messages).diffJson(expected);
    });
  });
});
