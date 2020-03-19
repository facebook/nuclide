"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = invariant;
/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

/*  strict */

function invariant(condition, format) {
  if (condition) return;

  let error = new Error(format);
  error.name = "Invariant Violation";
  throw error;
}
//# sourceMappingURL=invariant.js.map