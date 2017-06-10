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

import type {FlowIDEConnection} from '../lib/FlowIDEConnection';

import invariant from 'assert';

import {FlowIDEConnectionWatcher} from '../lib/FlowIDEConnectionWatcher';
import {Observable} from 'rxjs';

describe('FlowIDEConnectionWatcher', () => {
  let processFactory: Observable<?child_process$ChildProcess> = (null: any);
  let processFactoryReturn: ?child_process$ChildProcess = null;

  let ideConnectionCallback: JasmineSpy = (null: any);

  let ideConnectionFactory: JasmineSpy = (null: any);
  let currentFakeIDEConnection: ?{[string]: JasmineSpy} = null;
  let createFakeIDEConnection: () => FlowIDEConnection = (null: any);

  let watcher: FlowIDEConnectionWatcher = (null: any);

  let currentTime: number = (null: any);
  let waitingPromises: Set<{
    dueTime: number,
    resolve: () => void,
  }> = (null: any);

  // Apparently Jasmine doesn't mock Date.now(), and for whatever reason, using the Jasmine clock
  // mocks didn't properly call setTimeout (which sleep relies upon), which caused things to hang.
  // So I rolled my own.
  const tick: number => void = millis => {
    currentTime += millis;
    for (const item of waitingPromises) {
      if (currentTime >= item.dueTime) {
        item.resolve();
        waitingPromises.delete(item);
      }
    }
  };

  const sleep: (millis: number) => Promise<void> = millis => {
    let resolve = null;
    const promise = new Promise(r => {
      resolve = r;
    });
    invariant(resolve != null);
    const dueTime = currentTime + millis;
    waitingPromises.add({dueTime, resolve});
    return promise;
  };

  beforeEach(() => {
    createFakeIDEConnection = () => {
      return (jasmine.createSpyObj('FlowIDEconnection', [
        'onWillDispose',
        'dispose',
      ]): any);
    };
    processFactory = Observable.defer(() =>
      Observable.of(processFactoryReturn),
    );
    // We can use a stub value here because it's just passed through to the ideConnectionFactory
    processFactoryReturn = ({}: any);

    ideConnectionCallback = jasmine.createSpy('ideConnectionCallback');

    ideConnectionFactory = jasmine
      .createSpy('ideConnectionFactory')
      .andCallFake((...args) => {
        currentFakeIDEConnection = createFakeIDEConnection(...args);
        return currentFakeIDEConnection;
      });
    currentFakeIDEConnection = null;

    watcher = new FlowIDEConnectionWatcher(
      // Additional indirection so the callbacks can be reassigned in tests after the creation of
      // this object
      Observable.defer(() => processFactory),
      (...args) => ideConnectionCallback(...args),
      (...args) => ideConnectionFactory(...args),
    );

    currentTime = 42;
    waitingPromises = new Set();
    spyOn(watcher, '_getTimeMS').andCallFake(() => currentTime);
    spyOn(watcher, '_sleep').andCallFake(sleep);
  });

  it('should correctly start and keep alive an IDE connection', () => {
    runs(() => {
      watcher.start();
    });
    waitsFor(() => currentFakeIDEConnection != null);
    runs(() => {
      expect(ideConnectionCallback.calls[0].args).toEqual([
        currentFakeIDEConnection,
      ]);
      expect(ideConnectionCallback.callCount).toBe(1);
      invariant(currentFakeIDEConnection != null);
      expect(currentFakeIDEConnection.onWillDispose).toHaveBeenCalled();

      // TODO check that when the underlying connection dies, it gets re-established
      const onWillDisposeHandler: any =
        currentFakeIDEConnection.onWillDispose.calls[0].args[0];
      onWillDisposeHandler();
    });
    waitsFor(() => ideConnectionCallback.callCount === 3);
    runs(() => {
      expect(ideConnectionCallback.calls[1].args).toEqual([null]);
      expect(ideConnectionCallback.calls[2].args).toEqual([
        currentFakeIDEConnection,
      ]);
      invariant(currentFakeIDEConnection != null);
      watcher.dispose();
      expect(currentFakeIDEConnection.dispose).toHaveBeenCalled();
    });
  });

  it('should retry when the IDE process fails to start', () => {
    // Obviously, this will have to be updated if the number of retries is changed
    const processFactoryReturns = (([
      null,
      null,
      {},
    ]: any): Array<?child_process$ChildProcess>);
    runs(() => {
      let currentCall = 0;
      processFactory = Observable.defer(() => {
        invariant(currentCall < processFactoryReturns.length);
        const result = processFactoryReturns[currentCall];
        currentCall++;
        tick(7 * 60 * 1000);
        return Observable.of(result);
      });
      spyOn(processFactory, 'subscribe').andCallThrough();
    });
    waitsForPromise(() => watcher.start());
    runs(() => {
      expect(ideConnectionCallback.callCount).toBe(1);
      expect(ideConnectionFactory.callCount).toBe(1);
      expect(ideConnectionFactory.calls[0].args[0]).toBe(
        processFactoryReturns[2],
      );
      expect(processFactory.subscribe.callCount).toBe(3);
      watcher.dispose();
    });
  });

  it('should give up when the IDE process fails to start too many times', () => {
    // Obviously, this will have to be updated if the number of retries is changed
    const processFactoryReturns = (([
      null,
      null,
      null,
      {},
    ]: any): Array<?child_process$ChildProcess>);
    runs(() => {
      let currentCall = 0;
      processFactory = Observable.defer(() => {
        invariant(currentCall < processFactoryReturns.length);
        const result = processFactoryReturns[currentCall];
        currentCall++;
        tick(7 * 60 * 1000);
        return Observable.of(result);
      });
      spyOn(processFactory, 'subscribe').andCallThrough();
    });
    waitsForPromise(() => watcher.start());
    runs(() => {
      expect(processFactory.subscribe.callCount).toBe(3);
      expect(ideConnectionCallback.callCount).toBe(0);
      expect(ideConnectionFactory.callCount).toBe(0);
      watcher.dispose();
    });
  });

  it('should throttle attempts to start the IDE process', () => {
    waitsForPromise(async () => {
      processFactory = Observable.defer(() => Promise.resolve(null));
      spyOn(processFactory, 'subscribe').andCallThrough();
      watcher.start();

      await new Promise(resolve => setImmediate(resolve));
      expect(processFactory.subscribe.callCount).toBe(1);

      tick(1100);

      await new Promise(resolve => setImmediate(resolve));
      expect(processFactory.subscribe.callCount).toBe(2);
    });
  });

  it('should give up after too many unhealthy connections', () => {
    createFakeIDEConnection = () => {
      const spy = jasmine.createSpyObj('FlowIDEconnection', [
        'onWillDispose',
        'dispose',
      ]);
      spy.onWillDispose = spy.onWillDispose.andCallFake(cb => {
        cb();
      });
      return (spy: any);
    };
    runs(() => {
      watcher.start();
    });

    // After 20 unhealthy connections it should just give up entirely. Each connection leads to two
    // callbacks, since it calls the callback for the connection itself and then with `null` to
    // indicate that it has died.
    waitsFor(() => ideConnectionCallback.callCount === 40);
    waitsForPromise(async () => {
      // Check again in a short while to make sure we haven't caught an intermediate state
      await new Promise(setImmediate);
      expect(ideConnectionCallback.callCount).toBe(40);
    });
  });

  it('should only give up after too many *consecutive* unhealthy connections', () => {
    let createCount = 0;
    createFakeIDEConnection = () => {
      const spy = jasmine.createSpyObj('FlowIDEconnection', [
        'onWillDispose',
        'dispose',
      ]);
      spy.onWillDispose = spy.onWillDispose.andCallFake(cb => {
        if (createCount === 5) {
          // This will cause this one to be marked as healthy, since it survived for long enough.
          tick(11000);
        }
        createCount++;
        cb();
      });
      return (spy: any);
    };
    runs(() => {
      watcher.start();
    });

    waitsFor(() => ideConnectionCallback.callCount === 52);
    waitsForPromise(async () => {
      // Check again in a short while to make sure we haven't caught an intermediate state
      await new Promise(setImmediate);
      expect(ideConnectionCallback.callCount).toBe(52);
    });
  });
});
