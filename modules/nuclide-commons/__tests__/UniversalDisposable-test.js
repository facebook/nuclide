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
import UniversalDisposable from '../UniversalDisposable';

describe('UniversalDisposable', () => {
  it('disposes of the Disposable arguments', () => {
    const dispose = jest.fn();
    const universal = new UniversalDisposable({dispose});

    expect(dispose.mock.calls.length > 0).toBe(false);
    universal.dispose();
    expect(dispose.mock.calls.length).toBe(1);
  });

  it('throws if you add after disposing', () => {
    const universal = new UniversalDisposable();
    universal.dispose();
    expect(() => {
      universal.add(() => {});
    }).toThrow('Cannot add to an already disposed UniversalDisposable!');
  });

  it('calls function arguments', () => {
    const foo = jest.fn();
    const universal = new UniversalDisposable(foo);

    expect(foo.mock.calls.length > 0).toBe(false);
    universal.dispose();
    expect(foo.mock.calls.length).toBe(1);
  });

  it('calls unsubscribe arguments', () => {
    const unsubscribe = jest.fn();
    const universal = new UniversalDisposable(unsubscribe);

    expect(unsubscribe.mock.calls.length > 0).toBe(false);
    universal.dispose();
    expect(unsubscribe.mock.calls.length).toBe(1);
  });

  it('supports creation with mixed teardowns', () => {
    const dispose = jest.fn();
    const unsubscribe = jest.fn();
    const foo = jest.fn();
    const universal = new UniversalDisposable({dispose}, {unsubscribe}, foo);

    expect(dispose.mock.calls.length > 0).toBe(false);
    expect(unsubscribe.mock.calls.length > 0).toBe(false);
    expect(foo.mock.calls.length > 0).toBe(false);
    universal.dispose();
    expect(dispose.mock.calls.length).toBe(1);
    expect(unsubscribe.mock.calls.length).toBe(1);
    expect(foo.mock.calls.length).toBe(1);
  });

  it('supports adding mixed teardowns', () => {
    const dispose = jest.fn();
    const unsubscribe = jest.fn();
    const destroy = jest.fn();
    const destroyable = {destroy, onDidDestroy: jest.fn()};
    const foo = jest.fn();
    const universal = new UniversalDisposable();
    universal.add({dispose}, {unsubscribe}, destroyable, foo);

    expect(dispose.mock.calls.length > 0).toBe(false);
    expect(unsubscribe.mock.calls.length > 0).toBe(false);
    expect(destroy.mock.calls.length > 0).toBe(false);
    expect(foo.mock.calls.length > 0).toBe(false);
    universal.dispose();
    expect(dispose.mock.calls.length).toBe(1);
    expect(unsubscribe.mock.calls.length).toBe(1);
    expect(destroy.mock.calls.length).toBe(1);
    expect(foo.mock.calls.length).toBe(1);
  });

  it('supports unsubscribe as well', () => {
    const dispose = jest.fn();
    const unsubscribe = jest.fn();
    const foo = jest.fn();
    const universal = new UniversalDisposable({dispose}, {unsubscribe}, foo);

    expect(dispose.mock.calls.length > 0).toBe(false);
    expect(unsubscribe.mock.calls.length > 0).toBe(false);
    expect(foo.mock.calls.length > 0).toBe(false);
    universal.unsubscribe();
    expect(dispose.mock.calls.length).toBe(1);
    expect(unsubscribe.mock.calls.length).toBe(1);
    expect(foo.mock.calls.length).toBe(1);
  });

  it('multiple dispose/unsubscribe calls have no effect', () => {
    const dispose = jest.fn();
    const unsubscribe = jest.fn();
    const foo = jest.fn();
    const universal = new UniversalDisposable({dispose}, {unsubscribe}, foo);

    expect(dispose.mock.calls.length > 0).toBe(false);
    expect(unsubscribe.mock.calls.length > 0).toBe(false);
    expect(foo.mock.calls.length > 0).toBe(false);
    universal.unsubscribe();
    universal.dispose();
    universal.unsubscribe();
    universal.dispose();
    expect(dispose.mock.calls.length).toBe(1);
    expect(unsubscribe.mock.calls.length).toBe(1);
    expect(foo.mock.calls.length).toBe(1);
  });

  it('supports removal of the teardowns', () => {
    const dispose = {dispose: jest.fn()};
    const unsubscribe = {unsubscribe: jest.fn()};
    const foo = jest.fn();
    const universal = new UniversalDisposable(dispose, unsubscribe, foo);

    universal.remove(unsubscribe);
    universal.remove(dispose);
    universal.remove(foo);

    universal.dispose();

    expect(dispose.dispose.mock.calls.length > 0).toBe(false);
    expect(unsubscribe.unsubscribe.mock.calls.length > 0).toBe(false);
    expect(foo.mock.calls.length > 0).toBe(false);
  });

  it('can clear all of the teardowns', () => {
    const dispose = {dispose: jest.fn()};
    const unsubscribe = {unsubscribe: jest.fn()};
    const foo = jest.fn();
    const universal = new UniversalDisposable(dispose, unsubscribe, foo);

    universal.clear();

    universal.dispose();

    expect(dispose.dispose.mock.calls.length > 0).toBe(false);
    expect(unsubscribe.unsubscribe.mock.calls.length > 0).toBe(false);
    expect(foo.mock.calls.length > 0).toBe(false);
  });

  it('maintains implicit order of the teardowns', () => {
    const ids = [];

    const foo1 = () => ids.push(1);
    const foo2 = () => ids.push(2);
    const foo3 = () => ids.push(3);
    const foo4 = () => ids.push(4);

    const universal = new UniversalDisposable(foo1, foo3);
    universal.add(foo4, foo2);

    universal.dispose();

    expect(ids).toEqual([1, 3, 4, 2]);
  });

  describe('teardown priority', () => {
    it('calls dispose()', () => {
      const foo: Function = jest.fn();
      foo.dispose = jest.fn();
      foo.unsubscribe = jest.fn();

      const universal = new UniversalDisposable(foo);
      universal.dispose();

      expect(foo.dispose.mock.calls.length > 0).toBe(true);
      expect(foo.unsubscribe.mock.calls.length > 0).toBe(false);
      expect(foo.mock.calls.length > 0).toBe(false);
    });

    it('calls unsubscribe()', () => {
      const foo: Function = jest.fn();
      foo.dispose = null;
      foo.unsubscribe = jest.fn();

      const universal = new UniversalDisposable(foo);
      universal.dispose();

      expect(foo.unsubscribe.mock.calls.length > 0).toBe(true);
      expect(foo.mock.calls.length > 0).toBe(false);
    });

    it('calls the function', () => {
      const foo: Function = jest.fn();
      foo.dispose = null;
      foo.unsubscribe = null;

      const universal = new UniversalDisposable(foo);
      universal.dispose();

      expect(foo.mock.calls.length > 0).toBe(true);
    });
  });

  describe('addUntilDestroyed', () => {
    class MockDestructible {
      destroyCallbacks = new Set();
      destroy() {
        this.destroyCallbacks.forEach(x => x());
      }
      onDidDestroy(callback) {
        this.destroyCallbacks.add(callback);
        return new UniversalDisposable(() => {
          this.destroyCallbacks.delete(callback);
        });
      }
    }

    it('cleans everything up on destroy', () => {
      const universal = new UniversalDisposable();
      const mockDestructible = new MockDestructible();
      const disposable1 = new UniversalDisposable();
      const disposable2 = new UniversalDisposable();

      universal.addUntilDestroyed(mockDestructible, disposable1, disposable2);
      expect(universal.teardowns.size).toBe(1);
      mockDestructible.destroy();

      expect(universal.teardowns.size).toBe(0);
      expect(disposable1.disposed).toBe(true);
      expect(disposable2.disposed).toBe(true);
    });

    it('cleans up destroy handlers on dispose', () => {
      const universal = new UniversalDisposable();
      const mockDestructible = new MockDestructible();
      const disposable1 = new UniversalDisposable();

      universal.addUntilDestroyed(mockDestructible, disposable1);
      expect(universal.teardowns.size).toBe(1);
      universal.dispose();

      expect(disposable1.disposed).toBe(true);
      expect(mockDestructible.destroyCallbacks.size).toBe(0);
    });
  });
});
