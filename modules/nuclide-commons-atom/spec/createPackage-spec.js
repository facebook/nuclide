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
 */

import createPackage from '../createPackage';

describe('createPackage', () => {
  it('throws when the activation class contains an `initialize()`', () => {
    class Activation {
      initialize() {}
    }
    expect(() => createPackage({}, Activation)).toThrow(
      'Your activation class contains an "initialize" method, but that work should be done in the' +
        ' constructor.',
    );
  });

  it('throws when the activation class contains a `deactivate()`', () => {
    class Activation {
      deactivate() {}
    }
    expect(() => createPackage({}, Activation)).toThrow(
      'Your activation class contains an "deactivate" method. Please use "dispose" instead.',
    );
  });

  it("calls the activation's `dispose()` when deactivated", () => {
    let called = false;
    class Activation {
      dispose() {
        called = true;
      }
    }
    const pkg = {};
    createPackage(pkg, Activation);
    pkg.initialize();
    expect(called).toBe(false);
    pkg.deactivate();
    expect(called).toBe(true);
  });

  it('proxies methods to the activation instance', () => {
    let called = false;
    class Activation {
      doSomething() {
        called = true;
      }
    }
    const pkg = {};
    createPackage(pkg, Activation);
    pkg.initialize();
    pkg.doSomething();
    expect(called).toBe(true);
  });

  it('proxies activate()', () => {
    let state;
    class Activation {
      activate(serializedState) {
        state = serializedState;
      }
    }
    const pkg = {};
    createPackage(pkg, Activation);
    pkg.initialize();
    pkg.activate(1);
    expect(state).toBe(1);
  });

  it("throws if methods are called when the package isn't initialized", () => {
    let called = false;
    class Activation {
      doSomething() {
        called = true;
      }
    }
    const pkg = {};
    createPackage(pkg, Activation);
    pkg.initialize();
    pkg.deactivate();
    expect(() => {
      pkg.doSomething();
    }).toThrow('Package not initialized');
    expect(called).toBe(false);
  });

  it('contains methods inherited by the activation class', () => {
    class A {
      inheritedMethod() {}
    }
    class B extends A {}
    const pkg = {};
    createPackage(pkg, B);
    expect('inheritedMethod' in pkg).toBe(true);
  });
});
