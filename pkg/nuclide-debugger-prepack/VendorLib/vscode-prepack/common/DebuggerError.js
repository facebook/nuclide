"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
class DebuggerError extends Error {
  constructor(errorType, message) {
    super(`${errorType}: ${message}`);
    this.errorType = errorType;
    this.message = message;
  }
}
exports.DebuggerError = DebuggerError; /**
                                        * Copyright (c) 2017-present, Facebook, Inc.
                                        * All rights reserved.
                                        *
                                        * This source code is licensed under the BSD-style license found in the
                                        * LICENSE file in the root directory of this source tree. An additional grant
                                        * of patent rights can be found in the PATENTS file in the same directory.
                                        */

/*  strict */

// More error types will be added as needed
//# sourceMappingURL=DebuggerError.js.map