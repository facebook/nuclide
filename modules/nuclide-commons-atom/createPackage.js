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

import invariant from 'assert';

/**
 * Create an Atom package from an Activation constructor.
 *
 * Atom packages are obstensibly singletons, however they contain `activate()` and `deactivate()`
 * lifecycle methods which can be called multiple times. There's no use-case (so far as we know) for
 * invoking any other package methods while a package is not activated. Therefore, it makes more
 * sense to build packages as instances, constructed when a package is activated and destroyed when
 * the package is deactivated.
 *
 * Atom uses a plain `require` to load the module, and not babel's `require` interop. So if
 * `createPackage` were used as `export default createPackage(..)`, then Atom wouldn't be
 * able to find any package methods because the ES Module transform would output
 * `module.exports.default = {..};`. To workaround this, the module's `module.exports` is passed
 * to `createPackage` so we can attach whatever properties to it.
 *
 * It was a conscious decision to use `createPackage(module.exports, Activation)` instead of
 * `module.exports = createPackage(Activation)`, to avoid code style misunderstandings wrt
 * CommonJS vs ES Modules.
 */
export default function createPackage(
  moduleExports: Object,
  Activation: Class<any>,
): void {
  let activation = null;

  // Proxy method calls on the package to the activation object.
  for (const property of getPropertyList(Activation.prototype)) {
    if (typeof Activation.prototype[property] !== 'function') {
      continue;
    }
    if (property === 'constructor') {
      continue;
    }
    if (property === 'initialize') {
      throw new Error(
        'Your activation class contains an "initialize" method, but that work should be done in the' +
          ' constructor.',
      );
    }
    if (property === 'deactivate') {
      throw new Error(
        'Your activation class contains an "deactivate" method. Please use "dispose" instead.',
      );
    }

    moduleExports[property] = function(...args) {
      invariant(activation != null, 'Package not initialized');
      return activation[property](...args);
    };
  }

  /**
   * Calling `initialize()` creates a new instance.
   */
  moduleExports.initialize = (initialState: ?Object): void => {
    invariant(activation == null, 'Package already initialized');
    activation = new Activation(initialState);
  };

  /**
   * The `deactivate()` method is special-cased to null our activation instance reference.
   */
  moduleExports.deactivate = (): void => {
    invariant(activation != null, 'Package not initialized');
    if (typeof activation.dispose === 'function') {
      activation.dispose();
    }
    activation = null;
  };
}

function getPrototypeChain(prototype: Class<any>): Array<Class<any>> {
  let currentPrototype = prototype;
  const prototypes = [];
  while (currentPrototype != null) {
    prototypes.push(currentPrototype);
    currentPrototype = Object.getPrototypeOf(currentPrototype);
  }
  return prototypes;
}

/**
 * List the properties (including inherited ones) of the provided prototype, excluding the ones
 * inherited from `Object`.
 */
function getPropertyList(prototype: Class<any>): Array<string> {
  const properties = [];
  for (const proto of getPrototypeChain(prototype)) {
    if (proto === (Object: any).prototype) {
      break;
    }
    for (const property of Object.getOwnPropertyNames(proto)) {
      properties.push(property);
    }
  }
  return properties;
}
