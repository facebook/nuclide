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

import {FlowVersion} from '../lib/FlowVersion';

describe('FlowVersion', () => {
  let flowVersion: FlowVersion = (null: any);
  let getVersionSpy: JasmineSpy = (null: any);
  let fakeVersion: ?string = null;

  beforeEach(() => {
    getVersionSpy = jasmine
      .createSpy()
      .andCallFake(() => Promise.resolve(fakeVersion));
    flowVersion = new FlowVersion(getVersionSpy);
  });

  it('should return the version the first time', () => {
    waitsForPromise(async () => {
      fakeVersion = 'foo';
      expect(await flowVersion.getVersion()).toEqual('foo');
      expect(getVersionSpy.callCount).toEqual(1);
    });
  });

  it('should cache versions between calls', () => {
    waitsForPromise(async () => {
      fakeVersion = 'foo';
      await flowVersion.getVersion();
      fakeVersion = 'bar';
      expect(await flowVersion.getVersion()).toEqual('foo');
      expect(getVersionSpy.callCount).toEqual(1);
    });
  });

  it('should properly invalidate the cached result when invalidate is called', () => {
    waitsForPromise(async () => {
      fakeVersion = 'foo';
      await flowVersion.getVersion();
      fakeVersion = 'bar';
      flowVersion.invalidateVersion();
      expect(await flowVersion.getVersion()).toEqual('bar');
      expect(getVersionSpy.callCount).toEqual(2);
    });
  });

  it('should properly invalidate the cached result when enough time has elapsed', () => {
    waitsForPromise(async () => {
      fakeVersion = 'foo';
      await flowVersion.getVersion();
      fakeVersion = 'bar';
      advanceClock(11 * 60 * 1000);
      expect(await flowVersion.getVersion()).toEqual('bar');
      expect(getVersionSpy.callCount).toEqual(2);
    });
  });

  describe('satisfies', () => {
    it('work with older versions', () => {
      waitsForPromise(async () => {
        fakeVersion = '0.20.0';
        const satisfies = await flowVersion.satisfies('>=0.30.0');
        expect(satisfies).toEqual(false);
      });
    });

    it('work with newer versions', () => {
      waitsForPromise(async () => {
        fakeVersion = '0.40.0';
        const satisfies = await flowVersion.satisfies('>=0.30.0');
        expect(satisfies).toEqual(true);
      });
    });
  });
});
