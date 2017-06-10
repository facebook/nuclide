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

import {Observable} from 'rxjs';
import {BuckBuildSystem} from '../lib/BuckBuildSystem';
import invariant from 'assert';

describe('BuckBuildSystem', () => {
  let buckBuildSystem;
  beforeEach(() => {
    buckBuildSystem = new BuckBuildSystem();
  });

  describe('_consumeEventStream', () => {
    it('doesnt swallow log messages', () => {
      waitsForPromise(async () => {
        const result = await buckBuildSystem
          ._consumeEventStream(
            Observable.from([
              {type: 'log', message: 'test', level: 'error'},
              {type: 'log', message: 'test2', level: 'warning'},
              {type: 'progress', progress: 1},
            ]),
            '',
          )
          .toArray()
          .toPromise();

        expect(result).toEqual([
          {type: 'message', message: {text: 'test', level: 'error'}},
          {type: 'message', message: {text: 'test2', level: 'warning'}},
          {type: 'progress', progress: 1},
        ]);
      });
    });

    it('emits diagnostics', () => {
      waitsForPromise(async () => {
        const spy = jasmine.createSpy('diagnostics');
        const subscription = buckBuildSystem
          .getDiagnosticProvider()
          .updates.subscribe(spy);

        const diagnostic = {
          scope: 'file',
          providerName: 'Buck',
          type: 'Error',
          filePath: 'a',
        };

        const result = await buckBuildSystem
          ._consumeEventStream(
            Observable.from([
              {
                type: 'diagnostics',
                diagnostics: [diagnostic],
              },
              {
                type: 'diagnostics',
                diagnostics: [{...diagnostic, type: 'Warning'}],
              },
              {
                type: 'diagnostics',
                diagnostics: [{...diagnostic, filePath: 'b'}],
              },
            ]),
            '',
          )
          .toArray()
          .toPromise();

        // Check for the message indicating to look in diagnostics.
        expect(result.length).toEqual(1);
        const msg = result[0];
        expect(msg.type).toEqual('message');
        invariant(msg.type === 'message');
        expect(msg.message.level).toEqual('info');
        expect(msg.message.text).toContain('Diagnostics');

        expect(spy.calls.map(call => call.args[0])).toEqual([
          {
            filePathToMessages: new Map([['a', [diagnostic]]]),
          },
          {
            // Accumulate diagnostics per file.
            filePathToMessages: new Map([
              ['a', [diagnostic, {...diagnostic, type: 'Warning'}]],
            ]),
          },
          {
            // No need to emit diagnostics for 'a' again.
            filePathToMessages: new Map([
              ['b', {...diagnostic, filePath: 'b'}],
            ]),
          },
        ]);

        subscription.unsubscribe();
      });
    });
  });
});
