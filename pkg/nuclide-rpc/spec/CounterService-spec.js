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

import invariant from 'assert';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {ServiceTester} from './ServiceTester';

describe('CounterService', () => {
  let testHelper;
  let service;
  beforeEach(() => {
    testHelper = new ServiceTester();
    waitsForPromise(() =>
      testHelper.start(
        [
          {
            name: 'CounterService',
            definition: nuclideUri.join(__dirname, 'CounterService.def'),
            implementation: nuclideUri.join(__dirname, 'CounterService.js'),
          },
        ],
        'counter_protocol',
      ),
    );

    runs(() => {
      service = testHelper.getRemoteService('CounterService');
    });
  });

  it('Can create two remotable counters in parallel.', () => {
    waitsForPromise(async () => {
      invariant(service);

      let watchedCounters = 0;
      service.Counter.watchNewCounters().refCount().subscribe(async counter => {
        await counter.getCount();
        ++watchedCounters;
      });

      // Create two services.
      const counter1 = new service.Counter(3);
      const counter2 = new service.Counter(5);

      // Subscribe to events from counter1.
      let completed1 = false;
      counter1.watchChanges().refCount().subscribe(
        event => {
          expect(event.type).toBe('add');
          expect(event.oldValue).toBe(3);
          expect(event.newValue).toBe(4);
        },
        () => {},
        () => {
          completed1 = true;
        },
      );

      // Confirm their initial value.
      expect(await counter1.getCount()).toBe(3);
      expect(await counter2.getCount()).toBe(5);

      // Increment the counters / check values.
      await counter1.addCount(1);
      await counter2.addCount(2);
      expect(await counter1.getCount()).toBe(4);
      expect(await counter2.getCount()).toBe(7);

      // Call a static method that returns Counter instances.
      const counters = await service.Counter.listCounters();
      expect(await counters[0].getCount()).toBe(4);
      expect(await counters[1].getCount()).toBe(7);

      // Call a static method with a counter as an argument.
      expect(await service.Counter.indexOf(counter1)).toBe(0);
      expect(await service.Counter.indexOf(counter2)).toBe(1);

      // Dispose the counters, ensuring that they are removed from the global list.
      await counter1.dispose();
      expect((await service.Counter.listCounters()).length).toBe(1);
      await counter2.dispose();
      expect((await service.Counter.listCounters()).length).toBe(0);
      // Calling dispose multiple times should not throw.
      await counter2.dispose();

      // Wait for the counter1 Observable to complete.
      waitsFor(() => completed1, 'The counter1 Observable to complete.');

      // Wait for our watch to have seen all of the Counters.
      waitsFor(
        () => watchedCounters === 2,
        'We have watched two counters get created.',
      );
    });
  });

  it('can subscribe/unsubscribe to the same observable multiple times.', () => {
    waitsForPromise(async () => {
      invariant(service);

      const obs = service.Counter.watchNewCounters().refCount();

      let watchedCounters1 = 0;
      const sub1 = obs.subscribe(counter => {
        sub1.unsubscribe();
        ++watchedCounters1;
      });
      let watchedCounters2 = 0;
      const sub2 = obs.subscribe(counter => {
        ++watchedCounters2;
        if (watchedCounters2 === 2) {
          sub2.unsubscribe();
        }
      });

      // Create two services.
      const counter1 = new service.Counter(3);
      await counter1.getCount();

      const counter2 = new service.Counter(5);
      await counter2.getCount();

      const counter3 = new service.Counter(7);
      await counter3.getCount();

      expect(watchedCounters1).toBe(1);
      expect(watchedCounters2).toBe(2);
    });
  });

  afterEach(() => testHelper.stop());
});
