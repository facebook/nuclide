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

import typeof * as DummyService from './fixtures/dummy-service/DummyService';

import nuclideUri from 'nuclide-commons/nuclideUri';
import invariant from 'assert';
import {spawn} from 'nuclide-commons/process';
import {RpcProcess} from '../lib/RpcProcess';
import {ServiceRegistry} from '../../nuclide-rpc';
import {Scheduler} from 'rxjs';

describe('RpcProcess', () => {
  let server: RpcProcess;

  beforeEach(() => {
    const PROCESS_PATH = nuclideUri.join(
      __dirname,
      'fixtures/dummy-service/dummyioserver.py',
    );
    const OPTS = {
      cwd: nuclideUri.dirname(PROCESS_PATH),
      stdio: 'pipe',
      detached: false,
    };

    const serviceRegistry = new ServiceRegistry(
      [],
      [
        {
          name: 'dummy',
          definition: nuclideUri.join(
            __dirname,
            'fixtures/dummy-service/DummyService.js',
          ),
          implementation: nuclideUri.join(
            __dirname,
            'fixtures/dummy-service/DummyService.js',
          ),
          preserveFunctionNames: true,
        },
      ],
    );

    const processStream = spawn('python', [PROCESS_PATH], OPTS)
      // For the sake of our tests, simulate creating the process asynchronously.
      .subscribeOn(Scheduler.async);
    server = new RpcProcess('Dummy IO Server', serviceRegistry, processStream);
  });

  afterEach(() => {
    invariant(server != null);
    server.dispose();
  });

  function getService(): Promise<DummyService> {
    return server.getService('dummy');
  }

  it('should be able to complete calls', () => {
    waitsForPromise(async () => {
      // All methods except 'kill' and 'error' return the same result in our
      // dummy server.
      const response = await (await getService()).binarysystems();
      expect(response).toEqual({
        hello: 'Hello World',
      });
    });
  });

  it('should be able to handle multiple calls', () => {
    waitsForPromise(async () => {
      const service = await getService();
      const responses = await Promise.all([
        service.a(),
        service.b(),
        service.c(),
        service.d(),
      ]);
      expect(responses.length).toBe(4);
      expect(responses).toEqual([
        {hello: 'Hello World'},
        {hello: 'Hello World'},
        {hello: 'Hello World'},
        {hello: 'Hello World'},
      ]);
    });
  });

  it('should reject pending calls upon error', () => {
    waitsForPromise(async () => {
      try {
        await (await getService()).error();
        invariant(false, 'Fail - expected promise to reject');
      } catch (e) {
        expect(e).toEqual('Command to error received');
      }
    });
  });

  it('should reject pending calls upon the child process exiting', () => {
    waitsForPromise(async () => {
      const message = server
        .observeExitMessage()
        .take(1)
        .toPromise();
      try {
        await (await getService()).kill();
        invariant(false, 'Fail - expected promise to reject');
      } catch (e) {
        expect(
          e.message.startsWith(
            'Remote Error: Connection Closed processing message',
          ),
        ).toBeTruthy();
      }
      expect((await message).exitCode).toBe(0);
    });
  });

  it('should recover gracefully after the child process exits', () => {
    waitsForPromise(async () => {
      try {
        await (await getService()).kill();
        invariant(false, 'Fail - expected promise to reject');
      } catch (e) {
        // Ignore.
      }

      // Subsequent request should process successfully, meaning the killed
      // child process has been restarted.
      const response = await (await getService()).polarbears();
      expect(response).toEqual({
        hello: 'Hello World',
      });
      expect(server.isDisposed()).toBe(false);
    });
  });

  it('dispose should kill the process', () => {
    waitsForPromise(async () => {
      await getService();
      const process = server._process;
      invariant(process != null);
      const spy = jasmine.createSpy();
      process.on('exit', spy);
      server.dispose();
      waitsFor(() => spy.wasCalled);

      const exitSpy = jasmine.createSpy();
      server.observeExitMessage().subscribe(() => exitSpy());
      // Manual dispose should not trigger any side effects.
      expect(exitSpy).not.toHaveBeenCalled();
    });
  });

  it('should respond to dispose immediately if the process is created asynchronously', () => {
    waitsForPromise(async () => {
      const service = getService();
      server.dispose();
      try {
        await service;
      } catch (e) {
        return;
      }
      throw new Error('should have thrown');
    });
  });
});
