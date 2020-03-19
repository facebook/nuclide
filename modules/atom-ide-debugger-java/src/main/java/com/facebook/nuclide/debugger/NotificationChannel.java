/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import java.util.ArrayList;
import java.util.List;

/** Abstract channel to send client Nuclide notification messages. */
public abstract class NotificationChannel {
  private final List<String> _cache = new ArrayList<>();
  private boolean _channelAvailable = false;

  public final void enable() {
    _channelAvailable = true;
    flush();
  }

  public void send(String message) {
    if (_channelAvailable) {
      sendHelper(message);
    } else {
      _cache.add(message);
    }
  }

  private final void flush() {
    for (String message : _cache) {
      sendHelper(message);
    }
    _cache.clear();
  }

  protected abstract void sendHelper(String message);
}
