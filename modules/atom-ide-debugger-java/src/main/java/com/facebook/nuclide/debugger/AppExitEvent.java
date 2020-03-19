/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

/** Synchronize application exit event between threads. */
public class AppExitEvent {
  private final Lock _exitConditionLock = new ReentrantLock();
  private final Condition _exitCondition = _exitConditionLock.newCondition();

  public AppExitEvent() {}

  /** Wait until application is ready to exit. */
  public void waitForExitReady() throws InterruptedException {
    _exitConditionLock.lock();
    try {
      _exitCondition.await();
    } finally {
      _exitConditionLock.unlock();
    }
  }

  /** Notify any blocker that it is ready to exit. */
  public void notifyExit() {
    _exitConditionLock.lock();
    try {
      _exitCondition.signalAll();
    } finally {
      _exitConditionLock.unlock();
    }
  }
}
