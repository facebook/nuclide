/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */
import typeof {niceSafeSpawn as niceSafeSpawnType} from '../nice';

import {uncachedRequire} from '../test-helpers';
import {Observable} from 'rxjs';

describe('nice', () => {
  let niceSafeSpawn: niceSafeSpawnType = (null: any);

  let whichSpy = (null: any);
  let spawnSpy = (null: any);
  let shouldFindNiceCommand: boolean = (null: any);
  let shouldFindIoniceCommand: boolean = (null: any);
  // All we need here is a unique value to make sure that `nice` returns whatever `safeSpawn`
  // returns
  const fakeSafeSpawnReturn: child_process$ChildProcess = ({}: any);

  beforeEach(() => {
    jest.resetModules();
    shouldFindNiceCommand = true;
    shouldFindIoniceCommand = true;
    whichSpy = jest
      .spyOn(require('../which'), 'default')
      .mockImplementation(async command => {
        if (
          (shouldFindNiceCommand && command === 'nice') ||
          (shouldFindIoniceCommand && command === 'ionice')
        ) {
          return command;
        } else {
          return null;
        }
      });
    spawnSpy = jest
      .spyOn(require('../process'), 'spawn')
      .mockReturnValue(Observable.of(fakeSafeSpawnReturn));
    ({niceSafeSpawn} = (uncachedRequire(require, '../nice'): any));
  });

  it('should spawn `nice` and return whatever spawn returns', async () => {
    const execOptions = {};
    const result = await niceSafeSpawn('echo', ['hi'], execOptions);
    expect(spawnSpy).toHaveBeenCalledWith(
      'ionice',
      ['-n', '7', 'nice', 'echo', 'hi'],
      execOptions,
    );
    expect(result).toBe(fakeSafeSpawnReturn);
  });

  it('should spawn the command normally if nice and ionice cannot be found', async () => {
    shouldFindNiceCommand = false;
    shouldFindIoniceCommand = false;
    const execOptions = {};
    const result = await niceSafeSpawn('echo', ['hi'], execOptions);
    expect(spawnSpy).toHaveBeenCalledWith('echo', ['hi'], execOptions);
    expect(result).toBe(fakeSafeSpawnReturn);
  });

  it('should spawn with only nice if ionice cannot be found', async () => {
    shouldFindIoniceCommand = false;
    const execOptions = {};
    const result = await niceSafeSpawn('echo', ['hi'], execOptions);
    expect(spawnSpy).toHaveBeenCalledWith('nice', ['echo', 'hi'], execOptions);
    expect(result).toBe(fakeSafeSpawnReturn);
  });

  it('should spawn with only ionice if nice cannot be found', async () => {
    // I don't know when we would have ionice but not nice, but we may as well support this case.
    shouldFindNiceCommand = false;
    const execOptions = {};
    const result = await niceSafeSpawn('echo', ['hi'], execOptions);
    expect(spawnSpy).toHaveBeenCalledWith(
      'ionice',
      ['-n', '7', 'echo', 'hi'],
      execOptions,
    );
    expect(result).toBe(fakeSafeSpawnReturn);
  });

  it('should call which only once per command and cache the result', async () => {
    await niceSafeSpawn('echo', []);
    await niceSafeSpawn('echo', []);
    expect(whichSpy).toHaveBeenCalledWith('nice');
    expect(whichSpy).toHaveBeenCalledWith('ionice');
    expect(whichSpy.mock.calls.length).toBe(2);
  });
});
