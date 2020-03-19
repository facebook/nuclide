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

import type {HostServices} from '../lib/rpc-types';

import {Observable} from 'rxjs';
import {forkHostServices} from '../';

describe('HostServicesAggregator', () => {
  let hostObj;
  let host;
  let hostRelayObj;
  let hostRelay;
  let logger;

  beforeEach(() => {
    hostObj = jasmine.createSpyObj('host', [
      'consoleNotification',
      'dialogNotification',
      'dialogRequest',
      'showProgress',
      'dispose',
      'childRegister',
    ]);
    hostRelayObj = jasmine.createSpyObj('hostRelay', [
      'consoleNotification',
      'dialogNotification',
      'dialogRequest',
      'showProgress',
      'dispose',
      'childRegister',
    ]);
    hostObj.childRegister = jasmine
      .createSpy('childRegister')
      .andReturn(Promise.resolve(hostRelayObj));
    hostRelayObj.consoleNotification = jasmine
      .createSpy('consoleNotification')
      .andCallFake(hostObj.consoleNotification);
    host = ((hostObj: any): HostServices);
    hostRelay = ((hostRelayObj: any): HostServices);

    logger = ((jasmine.createSpyObj('logger', [
      'debug',
      'trace',
      'info',
      'error',
      'setLevel',
    ]): any): log4js$Logger);
  });

  it('relays to parent', () => {
    waitsForPromise(async () => {
      const child1 = await forkHostServices(host, logger);

      expect(host.childRegister.callCount).toEqual(1);
      expect(host.childRegister).toHaveBeenCalledWith(child1);

      child1.consoleNotification('fred', 'warning', 'hello');

      expect(hostRelay.consoleNotification.callCount).toEqual(1);
      expect(host.consoleNotification.callCount).toEqual(1);
      expect(host.consoleNotification).toHaveBeenCalledWith(
        'fred',
        'warning',
        'hello',
      );

      const child2 = await forkHostServices(host, logger);

      expect(host.childRegister.callCount).toEqual(2);
      expect(host.childRegister).toHaveBeenCalledWith(child2);

      child2.consoleNotification('jones', 'info', 'world');

      expect(hostRelay.consoleNotification.callCount).toEqual(2);
      expect(host.consoleNotification.callCount).toEqual(2);
      expect(host.consoleNotification).toHaveBeenCalledWith(
        'jones',
        'info',
        'world',
      );
    });
  });

  it('relays through aggregator', () => {
    waitsForPromise(async () => {
      const aggregator = await forkHostServices(host, logger);
      const originalMethod = aggregator.childRegister.bind(aggregator);
      let returnValue;
      spyOn(aggregator, 'childRegister').andCallFake(child => {
        returnValue = originalMethod(child);
        return returnValue;
      });
      spyOn(aggregator, 'consoleNotification').andCallThrough();

      const child1 = await forkHostServices(aggregator, logger);
      const relayForChild1 = ((await returnValue: any): HostServices);
      spyOn(relayForChild1, 'consoleNotification').andCallThrough();

      const child2 = await forkHostServices(aggregator, logger);
      const relayForChild2 = ((await returnValue: any): HostServices);
      spyOn(relayForChild2, 'consoleNotification').andCallThrough();

      expect(host.childRegister.callCount).toEqual(1);
      expect(aggregator.childRegister.callCount).toEqual(2);

      child1.consoleNotification('fred', 'warning', 'hello');

      expect(aggregator.consoleNotification.callCount).toEqual(0);
      expect(relayForChild1.consoleNotification.callCount).toEqual(1);
      expect(relayForChild2.consoleNotification.callCount).toEqual(0);
      expect(host.consoleNotification.callCount).toEqual(1);

      child2.consoleNotification('jones', 'info', 'world');

      expect(aggregator.consoleNotification.callCount).toEqual(0);
      expect(relayForChild1.consoleNotification.callCount).toEqual(1);
      expect(relayForChild2.consoleNotification.callCount).toEqual(1);
      expect(host.consoleNotification.callCount).toEqual(2);
    });
  });

  it('has its own relay#0 unrelated to children', () => {
    waitsForPromise(async () => {
      const aggregator = await forkHostServices(host, logger);
      spyOn(aggregator, 'consoleNotification').andCallThrough();
      const originalMethod = aggregator.childRegister.bind(aggregator);
      let returnValue;
      spyOn(aggregator, 'childRegister').andCallFake(child => {
        returnValue = originalMethod(child);
        return returnValue;
      });
      const child = await forkHostServices(aggregator, logger);
      const relayForChild = ((await returnValue: any): HostServices);
      spyOn(relayForChild, 'consoleNotification').andCallThrough();

      aggregator.consoleNotification('alfred', 'error', 'oops');

      expect(relayForChild.consoleNotification.callCount).toEqual(0);
      expect(aggregator.consoleNotification.callCount).toEqual(1);
      expect(hostRelay.consoleNotification.callCount).toEqual(1);

      child.consoleNotification('jones', 'warning', 'what');

      expect(relayForChild.consoleNotification.callCount).toEqual(1);
      expect(aggregator.consoleNotification.callCount).toEqual(1);
      expect(hostRelay.consoleNotification.callCount).toEqual(2);
    });
  });

  it('disposes all remaining children', () => {
    waitsForPromise(async () => {
      const aggregator = await forkHostServices(host, logger);
      const child1 = await forkHostServices(aggregator, logger);
      const child2 = await forkHostServices(aggregator, logger);
      spyOn(aggregator, 'dispose').andCallThrough();
      spyOn(child1, 'dispose').andCallThrough();
      spyOn(child2, 'dispose').andCallThrough();

      child1.dispose();

      expect(child1.dispose.callCount).toEqual(1);
      expect(child2.dispose.callCount).toEqual(0);
      expect(aggregator.dispose.callCount).toEqual(0);
      expect(hostRelay.dispose.callCount).toEqual(0);
      expect(host.dispose.callCount).toEqual(0);

      aggregator.dispose();

      expect(child1.dispose.callCount).toEqual(1);
      expect(child2.dispose.callCount).toEqual(1);
      expect(aggregator.dispose.callCount).toEqual(1);
      expect(hostRelay.dispose.callCount).toEqual(1);
      expect(host.dispose.callCount).toEqual(0);
    });
  });

  it('relays progress to parent', () => {
    waitsForPromise(async () => {
      const wrapper1 = jasmine.createSpyObj('w1', ['setTitle', 'dispose']);
      const wrapper2 = jasmine.createSpyObj('w2', ['setTitle', 'dispose']);
      const wrappers = [wrapper1, wrapper2];
      hostRelayObj.showProgress = jasmine
        .createSpy('showProgress')
        .andCallFake(async () => wrappers.shift());
      const child = await forkHostServices(host, logger);

      const p1 = await child.showProgress('ping1');
      p1.setTitle('a');
      expect(wrapper1.setTitle.mostRecentCall.args[0]).toEqual('a');

      const p2 = await child.showProgress('ping2');
      p2.setTitle('b');
      expect(wrapper1.setTitle.mostRecentCall.args[0]).toEqual('a');
      expect(wrapper2.setTitle.mostRecentCall.args[0]).toEqual('b');

      expect(wrapper2.dispose.callCount).toEqual(0);
      p2.dispose();
      expect(wrapper2.dispose.callCount).toEqual(1);

      expect(wrapper1.dispose.callCount).toEqual(0);
      p1.dispose();
      expect(wrapper1.dispose.callCount).toEqual(1);
    });
  });

  it('disposes progress cleanly', () => {
    waitsForPromise(async () => {
      const wrapper = jasmine.createSpyObj('wrapper', ['setTitle', 'dispose']);
      hostRelayObj.showProgress = jasmine
        .createSpy('showProgress')
        .andReturn(Promise.resolve(wrapper));

      const child = await forkHostServices(host, logger);
      const p = await child.showProgress('ping');
      child.dispose();
      expect(wrapper.dispose.callCount).toEqual(1);
      p.setTitle('a');
      expect(wrapper.setTitle.callCount).toEqual(0);
      p.dispose();
      expect(wrapper.dispose.callCount).toEqual(1);
    });
  });

  it('has no races on showProgress and child disposal', () => {
    waitsForPromise(async () => {
      const wrapper = jasmine.createSpyObj('wrapper', ['setTitle', 'dispose']);
      hostRelayObj.showProgress = jasmine
        .createSpy('showProgress')
        .andReturn(Promise.resolve(wrapper));

      const child1 = await forkHostServices(host, logger);
      const child2 = await forkHostServices(child1, logger);
      const pPromise = child2.showProgress('ping');
      child2.dispose();
      const p = await pPromise;

      // "p" should be a no-op Progress object, since it was disposed.
      p.setTitle('a');
      expect(wrapper.setTitle.callCount).toEqual(0);
      p.dispose();

      // Wrapper should still be disposed (asynchronously).
      await waitsFor(() => wrapper.dispose.wasCalled);
      expect(wrapper.dispose.callCount).toEqual(1);
    });
  });

  it('will unsubscribe from dialogs upon dispose', () => {
    waitsForPromise(async () => {
      let hasSubscribed = false;
      let hasUnsubscribed = false;

      hostRelayObj.dialogRequest = jasmine.createSpy('dialogRequest').andReturn(
        Observable.create(observer => {
          hasSubscribed = true;
          return () => {
            hasUnsubscribed = true;
          };
        }).publish(),
      );

      const aggregator = await forkHostServices(host, logger);

      expect(hasSubscribed).toEqual(false);

      const promise = aggregator
        .dialogRequest('info', 'hello', [], 'close')
        .refCount()
        .toPromise();

      expect(hasSubscribed).toEqual(true);
      expect(hasUnsubscribed).toEqual(false);

      aggregator.dispose();

      expect(hasUnsubscribed).toEqual(true);
      expect(await promise).toBeUndefined();
    });
  });

  it('is no-op after dispose', () => {
    waitsForPromise(async () => {
      const aggregator1 = await forkHostServices(host, logger);
      const aggregator2 = await forkHostServices(aggregator1, logger);
      aggregator1.dispose();
      aggregator2.consoleNotification('noop', 'warning', 'goodbye');
    });
  });

  it('forks disposed children after dispose', () => {
    waitsForPromise(async () => {
      const aggregator = await forkHostServices(host, logger);
      aggregator.consoleNotification('op', 'warning', 'hello');
      expect(hostRelay.consoleNotification.callCount).toEqual(1);
      aggregator.dispose();

      const child = await forkHostServices(aggregator, logger);
      expect((child: any).isDisposed()).toEqual(true);
      child.consoleNotification('noop', 'warning', 'goodbye');
      expect(hostRelay.consoleNotification.callCount).toEqual(1);
      child.dispose();
    });
  });
});
