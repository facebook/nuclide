/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

/** Base class for debugger command interpreter. */
abstract class CommandInterpreterBase {
  private final ContextManager _contextManager;

  CommandInterpreterBase(NotificationChannel channel, AppExitEvent appExitNotifier) {
    _contextManager = new ContextManager(this, channel, appExitNotifier);
  }

  protected ContextManager getContextManager() {
    return _contextManager;
  }
}
