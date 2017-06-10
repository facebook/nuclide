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

require('jasmine-node');

/**
 * unspy is a ported utility from Atom's `spec-helper.coffee` that restores the
 * jasmine spied function on an object to its original value.
 */
jasmine.unspy = function unspy(object: Object, methodName: string) {
  if (!object[methodName].hasOwnProperty('originalValue')) {
    throw new Error('Not a spy ' + methodName);
  }
  object[methodName] = object[methodName].originalValue;
};
