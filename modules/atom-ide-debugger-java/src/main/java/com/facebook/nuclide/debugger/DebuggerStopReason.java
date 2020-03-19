/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

public enum DebuggerStopReason {
  NONE,
  SINGLE_STEP,
  LOADER_BREAK,
  ASYNC_BREAK,
  BREAKPOINT,
  EXCEPTION,
};
