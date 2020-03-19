/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */
import {FlowVersion} from '../lib/FlowVersion';

describe('FlowVersion', () => {
  let flowVersion: FlowVersion = (null: any);
  let getVersionSpy;
  let fakeVersion: ?string = null;

  beforeEach(() => {
    jest.useRealTimers();
    getVersionSpy = jest
      .fn()
      .mockImplementation(() => Promise.resolve(fakeVersion));
    flowVersion = new FlowVersion(getVersionSpy);
  });

  it('should return the version the first time', async () => {
    fakeVersion = 'foo';
    expect(await flowVersion.getVersion()).toEqual('foo');
    expect(getVersionSpy.mock.calls.length).toEqual(1);
  });

  it('should cache versions between calls', async () => {
    fakeVersion = 'foo';
    await flowVersion.getVersion();
    fakeVersion = 'bar';
    expect(await flowVersion.getVersion()).toEqual('foo');
    expect(getVersionSpy.mock.calls.length).toEqual(1);
  });

  it('should properly invalidate the cached result when invalidate is called', async () => {
    fakeVersion = 'foo';
    await flowVersion.getVersion();
    fakeVersion = 'bar';
    flowVersion.invalidateVersion();
    expect(await flowVersion.getVersion()).toEqual('bar');
    expect(getVersionSpy.mock.calls.length).toEqual(2);
  });

  it.skip('should properly invalidate the cached result when enough time has elapsed', async () => {
    jest.useFakeTimers();
    fakeVersion = 'foo';
    await flowVersion.getVersion();
    fakeVersion = 'bar';
    jest.advanceTimersByTime(11 * 60 * 1000);
    expect(await flowVersion.getVersion()).toEqual('bar');
    expect(getVersionSpy.mock.calls.length).toEqual(2);
  });

  describe('satisfies', () => {
    it('work with older versions', async () => {
      fakeVersion = '0.20.0';
      const satisfies = await flowVersion.satisfies('>=0.30.0');
      expect(satisfies).toEqual(false);
    });

    it('work with newer versions', async () => {
      fakeVersion = '0.40.0';
      const satisfies = await flowVersion.satisfies('>=0.30.0');
      expect(satisfies).toEqual(true);
    });
  });
});
