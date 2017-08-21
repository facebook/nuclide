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
import type {
  BusySignalService,
  BusySignalOptions,
  BusyMessage,
} from '../../../modules/atom-ide-ui/pkg/atom-ide-busy-signal/lib/types.js';

import {Observable} from 'rxjs';
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
          message:
            'Flow server is initializing (host.example.com:/remote/root)',
        },
        {
          message: 'Flow server is busy (/local/root)',
          dispose: true,
        },
        {
          message:
            'Flow server is initializing (host.example.com:/remote/root)',
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
      const mockBusySignal: BusySignalService = {
        reportBusyWhile() {
          throw new Error('stub');
        },
        reportBusy(title?: string, options?: BusySignalOptions) {
          let currentTitle = title;
          messages.push({message: currentTitle});
          const busyMessage: BusyMessage = {
            setTitle: title2 => {
              currentTitle = title2;
              messages.push({message: currentTitle});
            },
            dispose: () => {
              messages.push({message: currentTitle, dispose: true});
            },
          };
          return busyMessage;
        },
        dispose() {},
      };
      serverStatusUpdatesToBusyMessages(Observable.from(input), mockBusySignal);
      expect(messages).diffJson(expected);
    });
  });
});
