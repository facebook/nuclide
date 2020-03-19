/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

/** Notification channel for console output. */
public class ConsoleNotificationChannel extends NotificationChannel {
  private boolean _channelAvailable = false;

  public ConsoleNotificationChannel() {}

  @Override
  protected void sendHelper(String message) {
    System.err.println(message);
  }
}
