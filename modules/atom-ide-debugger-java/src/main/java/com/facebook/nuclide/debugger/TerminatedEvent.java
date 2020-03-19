/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import org.json.JSONObject;

public class TerminatedEvent extends base$Event {
  private JSONObject body;

  public TerminatedEvent() {
    super("terminated");
    body = new JSONObject();
  }

  public TerminatedEvent setRestart(Boolean restart) {
    if (restart != null) {
      body.put("restart", restart);
    }
    return this;
  }

  public JSONObject toJSON() {
    return super.toJSON().put("body", body);
  }
}
