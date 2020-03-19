/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @noflow
 * @format
 */
'use strict';

/* eslint nuclide-internal/no-commonjs: 0 */

/**
 * This rule prevents instantiation of the Disposable or CompositeDisposable classes.
 * Instead, the UniversalDisposable class should be instantiated (UniversalDisposable
 * contains a superset of the functionality of Disposable and CompositeDisposable).
 */

const DISALLOWED_DISPOSABLES = ['CompositeDisposable', 'Disposable'];

const reportIncorrectDisposable = (context, node) => {
  const message = 'Incorrect Disposable Used (must use UniversalDisposable)';
  context.report({node, message});
};

module.exports = context => {
  return {
    NewExpression(node) {
      const isDisallowedDisposable = DISALLOWED_DISPOSABLES.includes(
        node.callee.name,
      );
      if (isDisallowedDisposable) {
        reportIncorrectDisposable(context, node);
      }
    },
  };
};
