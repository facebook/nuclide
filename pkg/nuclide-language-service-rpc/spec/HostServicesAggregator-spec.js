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
      'dispose',
      'childRegister',
    ]);
    hostRelayObj = jasmine.createSpyObj('hostRelay', [
      'consoleNotification',
      'dialogNotification',
      'dialogRequest',
      'dispose',
      'childRegister',
    ]);
    hostObj.childRegister = jasmine
      .createSpy('childRegister')
      .andReturn(hostRelayObj);
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
});
