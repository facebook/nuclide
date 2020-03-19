/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import org.json.JSONObject;

public abstract class base$Event extends base$ProtocolMessage {
  public String event;

  public base$Event(String event) {
    super("event");
    this.event = event;
  }

  public JSONObject toJSON() {
    return super.toJSON().put("event", event);
  }
}
